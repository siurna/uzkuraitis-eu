import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { rooms, voters } from "@/lib/db/schema";
import {
  findRoomByCodeWithToken,
  changeRoomCode,
  invalidateRoomCache,
} from "@/lib/rooms";
import { broadcastToRoom } from "@/lib/realtime-server";
import { broadcastLeaderboardUpdate } from "@/lib/leaderboard";
import { pushToRoom } from "@/lib/push";
import { getCountry, countryName } from "@/lib/countries";
import { t } from "@/lib/i18n";
import { checkAndIncrement } from "@/lib/rate-limit";
import { participantPhoto } from "@/lib/participants";
import {
  postSystemMessage,
  postNowPlayingMessage,
  postResultsMessage,
  showStatusAnnouncement,
} from "@/lib/chat-system";

// Per-room admin endpoint. All actions require an "X-Admin-Token" header
// matching the room's stored token. The token is generated at room
// creation and bundled into the share-link the host gets.
//
// PATCH    edit room props (name, voting toggle, home country, code)
// DELETE   wipe every voter (and their votes) in this room
//
// Sub-routes for results/facts/import live in this directory's siblings.

type RouteCtx = { params: Promise<{ code: string }> };

const PatchSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  votingEnabled: z.boolean().optional(),
  tallyEnabled: z.boolean().optional(),
  commentatorEnabled: z.boolean().optional(),
  homeCountryCode: z.string().length(2).optional(),
  code: z.string().min(6).max(6).optional(),
  // Now-playing country (ISO-2 lowercase) or null to clear.
  nowPlayingCode: z.string().length(2).nullable().optional(),
  // Show state.
  showStatus: z
    .enum(["not_started", "in_progress", "break", "ended"])
    .optional(),
});

async function requireRoomAdmin(req: Request, code: string) {
  const token = req.headers.get("x-admin-token") ?? "";
  const room = await findRoomByCodeWithToken(code, token);
  if (!room) return null;
  return room;
}

export async function GET(req: Request, { params }: RouteCtx) {
  const { code } = await params;
  const room = await requireRoomAdmin(req, code);
  if (!room) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }
  return NextResponse.json({
    room: {
      id: room.id,
      code: room.code,
      name: room.name,
      votingEnabled: room.votingEnabled,
      tallyEnabled: room.tallyEnabled,
      commentatorEnabled: room.commentatorEnabled,
      homeCountryCode: room.homeCountryCode,
      nowPlayingCode: room.nowPlayingCode,
      showStatus: room.showStatus,
    },
  });
}

export async function PATCH(req: Request, { params }: RouteCtx) {
  const { code } = await params;
  const room = await requireRoomAdmin(req, code);
  if (!room) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }
  // Each successful PATCH triggers up to a handful of broadcasts ×
  // every connected client, plus DB writes for system messages and
  // push fan-outs. A leaked admin link could be rage-clicked into a
  // quota event; cap to 60 patches/min per room (one per second is
  // still far more than a real host needs).
  const limited = await checkAndIncrement(`manage:${room.id}`, 60, 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Slow down — too many room updates." },
      { status: 429 },
    );
  }
  const parsed = PatchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { code: nextCode, nowPlayingCode: nextNowPlaying, ...rest } = parsed.data;
  const nowPlayingChanged =
    nextNowPlaying !== undefined && nextNowPlaying !== room.nowPlayingCode;

  // Apply non-code fields first.
  const updates: Record<string, unknown> = { ...rest };
  if (nextNowPlaying !== undefined) {
    updates.nowPlayingCode = nextNowPlaying;
    // Running-order position follows the country's startlist order.
    updates.runningOrderPos = nextNowPlaying ? getCountry(nextNowPlaying)?.order ?? null : null;
  }
  if (Object.keys(updates).length > 0) {
    await db.update(rooms).set(updates).where(eq(rooms.id, room.id));
    // Bust the in-memory room cache so the next request inside this
    // Lambda's 5s window doesn't read the pre-update row. Without
    // this, a host could flip voting / change now-playing and watch
    // the OLD value bleed back into responses for a few seconds.
    invalidateRoomCache(room.code);
  }

  // Code change goes through changeRoomCode for collision check.
  let newCode = room.code;
  if (nextCode && nextCode !== room.code) {
    const updated = await changeRoomCode(room.id, nextCode);
    if (!updated) {
      return NextResponse.json(
        { error: "That code is taken or invalid." },
        { status: 409 },
      );
    }
    newCode = updated.code;
  }

  // Broadcasts: room props change always, leaderboard if tally flipped,
  // and now-playing:change when the host moves the active country (the
  // event carries the new code so clients can swarm immediately without
  // a refetch race).
  // Always announce the room-prop change so listeners refresh
  // votingEnabled/nowPlayingCode/showStatus etc. The duplicate
  // unconditional `leaderboard:updated` that used to live here was
  // dragging every viewer into a leaderboard recompute on every
  // PATCH (rename, voting toggle, now-playing pick) — now scoped to
  // the tally-flip block at the bottom of this handler.
  await broadcastToRoom(newCode, { type: "room:updated" });
  if (nowPlayingChanged) {
    await broadcastToRoom(newCode, {
      type: "now-playing:change",
      countryCode: nextNowPlaying ?? null,
    });
    // Push: anyone with nowPlaying=true gets a system-level nudge so
    // they don't miss the country change when the app is backgrounded.
    if (nextNowPlaying) {
      const c = getCountry(nextNowPlaying);
      pushToRoom(
        room.id,
        (prefs) => !!prefs.nowPlaying,
        (lang) => ({
          title: t(
            lang,
            "push_now_playing_title",
            c?.flag ? `${c.flag} ` : "",
            countryName(nextNowPlaying, lang) ?? nextNowPlaying.toUpperCase(),
          ),
          body: c?.artist
            ? t(lang, "push_now_playing_body_song", c.artist, c.song ?? "")
            : t(lang, "push_now_playing_body_open"),
          url: `/r/${newCode}`,
          tag: `now-playing:${newCode}`,
          image: participantPhoto(nextNowPlaying) ?? undefined,
        }),
      ).catch(() => {});
      // Full-width "now on stage" banner in the room chat. Awaited so the
      // insert + broadcast actually complete before the lambda is frozen.
      await postNowPlayingMessage(newCode, room.id, nextNowPlaying);
    }
  }
  if (parsed.data.votingEnabled !== undefined) {
    const open = parsed.data.votingEnabled;
    pushToRoom(
      room.id,
      (prefs) => !!prefs.votingState,
      (lang) => ({
        title: t(lang, open ? "push_voting_open_title" : "push_voting_closed_title"),
        body: t(lang, open ? "push_voting_open_body" : "push_voting_closed_body"),
        url: `/r/${newCode}/vote`,
        tag: `voting:${newCode}`,
      }),
    ).catch(() => {});
  }
  // Only fire the "results are in" push on the actual false → true
  // edge. Earlier rev fired any time `tallyEnabled: true` arrived in
  // the PATCH body, so a host toggling off → on, or just tapping
  // Reveal twice, re-pushed every subscriber. Mirrors the chat-card
  // gate further down (`room.tallyEnabled !== true`).
  if (parsed.data.tallyEnabled === true && room.tallyEnabled !== true) {
    pushToRoom(
      room.id,
      (prefs) => !!prefs.resultsTallied,
      (lang) => ({
        title: t(lang, "push_results_title"),
        body: t(lang, "push_results_body"),
        url: `/r/${newCode}`,
        tag: `results:${newCode}`,
      }),
    ).catch(() => {});
  }

  // Meta-narrate state changes in chat. Awaited (postSystemMessage
  // swallows its own errors) so the rows land before the lambda freezes.
  if (
    parsed.data.showStatus !== undefined &&
    parsed.data.showStatus !== room.showStatus
  ) {
    await postSystemMessage(
      newCode,
      room.id,
      showStatusAnnouncement(parsed.data.showStatus),
    );
  }
  if (
    parsed.data.votingEnabled !== undefined &&
    parsed.data.votingEnabled !== room.votingEnabled
  ) {
    await postSystemMessage(
      newCode,
      room.id,
      parsed.data.votingEnabled ? { key: "sys_voting_open" } : { key: "sys_voting_closed" },
    );
  }
  if (parsed.data.tallyEnabled === true && room.tallyEnabled !== true) {
    await postResultsMessage(newCode, {
      id: room.id,
      homeCountryCode: room.homeCountryCode,
      tallyEnabled: true,
      highlightThreshold: room.highlightThreshold,
    });
    await broadcastToRoom(newCode, { type: "leaderboard:updated" });
  }
  return NextResponse.json({ ok: true, code: newCode });
}

export async function DELETE(req: Request, { params }: RouteCtx) {
  const { code } = await params;
  const room = await requireRoomAdmin(req, code);
  if (!room) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }
  await db.delete(voters).where(eq(voters.roomId, room.id));
  await broadcastToRoom(room.code, { type: "scores:updated" });
  await broadcastLeaderboardUpdate(room);
  return NextResponse.json({ ok: true });
}
