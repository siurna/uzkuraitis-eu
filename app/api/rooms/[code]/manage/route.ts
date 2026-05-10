import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { rooms, voters } from "@/lib/db/schema";
import {
  findRoomByCodeWithToken,
  changeRoomCode,
} from "@/lib/rooms";
import { broadcastToRoom } from "@/lib/liveblocks-server";
import { pushToRoom } from "@/lib/push";
import { getCountry } from "@/lib/countries";

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
  homeCountryCode: z.string().length(2).optional(),
  code: z.string().min(6).max(6).optional(),
  // Now-playing country (ISO-2 lowercase) or null to clear.
  nowPlayingCode: z.string().length(2).nullable().optional(),
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
      homeCountryCode: room.homeCountryCode,
      nowPlayingCode: room.nowPlayingCode,
    },
  });
}

export async function PATCH(req: Request, { params }: RouteCtx) {
  const { code } = await params;
  const room = await requireRoomAdmin(req, code);
  if (!room) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
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
  if (nextNowPlaying !== undefined) updates.nowPlayingCode = nextNowPlaying;
  if (Object.keys(updates).length > 0) {
    await db.update(rooms).set(updates).where(eq(rooms.id, room.id));
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
  await broadcastToRoom(newCode, { type: "room:updated" });
  await broadcastToRoom(newCode, { type: "leaderboard:updated" });
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
        {
          title: `${c?.name ?? nextNowPlaying.toUpperCase()} is on stage`,
          body: c?.artist
            ? `${c.artist}${c.song ? ` — ${c.song}` : ""}`
            : "Tap to open the room",
          url: `/r/${newCode}`,
          tag: `now-playing:${newCode}`,
        },
      ).catch(() => {});
    }
  }
  if (parsed.data.votingEnabled !== undefined) {
    pushToRoom(
      room.id,
      (prefs) => !!prefs.votingState,
      {
        title: parsed.data.votingEnabled
          ? "Voting is open"
          : "Voting just closed",
        body: parsed.data.votingEnabled
          ? "Cast your TOP10 before the show kicks off."
          : "Results coming in shortly.",
        url: `/r/${newCode}/vote`,
        tag: `voting:${newCode}`,
      },
    ).catch(() => {});
  }
  if (parsed.data.tallyEnabled === true) {
    pushToRoom(
      room.id,
      (prefs) => !!prefs.resultsTallied,
      {
        title: "Results are tallied",
        body: "Open the leaderboard to see how you did.",
        url: `/r/${newCode}`,
        tag: `results:${newCode}`,
      },
    ).catch(() => {});
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
  await broadcastToRoom(room.code, { type: "leaderboard:updated" });
  return NextResponse.json({ ok: true });
}
