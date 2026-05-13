import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { rooms } from "@/lib/db/schema";
import { isAdminAuthed } from "@/lib/admin/session";
import { broadcastToRoom } from "@/lib/liveblocks-server";
import { pushToRoom } from "@/lib/push";
import { getCountry } from "@/lib/countries";
import { participantPhoto } from "@/lib/participants";
import {
  postSystemMessage,
  postNowPlayingMessage,
  postCommentatorMessage,
  showStatusAnnouncement,
} from "@/lib/chat-system";

// Global live controller. POST sets show status / now-playing on EVERY
// room at once and broadcasts the change to each — for running the
// real broadcast from the back. Passkey-gated (admin session); the
// per-room magic-link page can still override an individual room.
//
// GET returns the most-common current state across rooms so the admin
// page can show "what's set right now".

const PostSchema = z.object({
  showStatus: z
    .enum(["not_started", "in_progress", "break", "ended"])
    .optional(),
  nowPlayingCode: z.string().length(2).nullable().optional(),
});

export async function GET() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }
  const rows = await db
    .select({
      showStatus: rooms.showStatus,
      nowPlayingCode: rooms.nowPlayingCode,
      runningOrderPos: rooms.runningOrderPos,
    })
    .from(rooms);
  // Mode of each field — what the admin most recently broadcast tends
  // to be the value shared by the majority of rooms.
  const mode = <T extends string | number | null>(values: T[]): T | null => {
    const counts = new Map<string, { value: T; n: number }>();
    for (const v of values) {
      const key = String(v);
      const e = counts.get(key) ?? { value: v, n: 0 };
      e.n += 1;
      counts.set(key, e);
    }
    let best: { value: T; n: number } | null = null;
    for (const e of counts.values()) if (!best || e.n > best.n) best = e;
    return best?.value ?? null;
  };
  return NextResponse.json({
    roomCount: rows.length,
    showStatus: mode(rows.map((r) => r.showStatus)) ?? "not_started",
    nowPlayingCode: mode(rows.map((r) => r.nowPlayingCode)),
    runningOrderPos: mode(rows.map((r) => r.runningOrderPos)),
  });
}

export async function POST(req: Request) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }
  const parsed = PostSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { showStatus, nowPlayingCode } = parsed.data;

  const update: Record<string, unknown> = {};
  if (showStatus !== undefined) update.showStatus = showStatus;
  if (nowPlayingCode !== undefined) {
    update.nowPlayingCode = nowPlayingCode;
    // The running-order position is derived from the country's startlist
    // order — no separate control.
    update.runningOrderPos = nowPlayingCode ? getCountry(nowPlayingCode)?.order ?? null : null;
  }

  await db.update(rooms).set(update);

  // Broadcast to every room + drop a system chat line where relevant.
  const all = await db.select({ id: rooms.id, code: rooms.code }).from(rooms);
  await Promise.all(
    all.map(async ({ id, code }) => {
      await broadcastToRoom(code, { type: "room:updated" });
      if (nowPlayingCode !== undefined) {
        await broadcastToRoom(code, {
          type: "now-playing:change",
          countryCode: nowPlayingCode ?? null,
        });
        if (nowPlayingCode) {
          await postNowPlayingMessage(code, id, nowPlayingCode);
          await postCommentatorMessage(code, id, nowPlayingCode);
          const c = getCountry(nowPlayingCode);
          await pushToRoom(
            id,
            (prefs) => !!prefs.nowPlaying,
            {
              title: `${c?.flag ? `${c.flag} ` : ""}${c?.name ?? nowPlayingCode.toUpperCase()} is on stage`,
              body: c?.artist
                ? `${c.artist}${c.song ? ` — ${c.song}` : ""}`
                : "Tap to open the room",
              url: `/r/${code}`,
              tag: `now-playing:${code}`,
              image: participantPhoto(nowPlayingCode) ?? undefined,
            },
          ).catch(() => {});
        }
      }
      if (showStatus !== undefined) {
        await postSystemMessage(code, id, showStatusAnnouncement(showStatus));
      }
    }),
  );

  return NextResponse.json({
    ok: true,
    rooms: all.length,
    nowPlaying: nowPlayingCode ? getCountry(nowPlayingCode)?.name ?? null : null,
  });
}
