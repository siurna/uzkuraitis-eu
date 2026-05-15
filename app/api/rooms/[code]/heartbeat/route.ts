import { NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { voters } from "@/lib/db/schema";
import { findRoomByCode } from "@/lib/rooms";
import { guardSession } from "@/lib/server-session";
import { checkAndIncrement } from "@/lib/rate-limit";

// Presence-as-REST heartbeat. The room shell pings this every 60s
// (and on visibilitychange when the tab returns) carrying the full
// session-state snapshot. The /participants endpoint reads from
// voters.{name, avatarId, vibe, seenAt, updatedAt} to render WhosHere
// without using Supabase Realtime presence at all — eliminates the
// per-client rate limit class of bugs that was kicking tabs off
// the channel mid-show.
//
// Upserts on `(roomId, sessionId)` (covered by the
// `voters_room_session_unique` index). The same row backs voting,
// so a viewer who's currently watching but hasn't cast a ballot
// still gets a row (just with the bet/vote columns null) — they
// can show up in WhosHere from the moment they enter the room.
// If they later vote, the same row gets updated with their ballot.

type RouteCtx = { params: Promise<{ code: string }> };

const BodySchema = z.object({
  session: z.string().min(8).max(64),
  // All optional — a fresh tab that hasn't passed the name gate yet
  // still pings the heartbeat so admin active-count works; only
  // viewers with a name show up in WhosHere downstream.
  name: z.string().trim().min(1).max(40).optional(),
  avatarId: z.string().trim().min(1).max(40).optional(),
  vibe: z.number().int().min(0).max(1000).optional(),
  seenAt: z.string().datetime().optional(),
  // Leave beacon. The room-shell fires this on `pagehide` via
  // navigator.sendBeacon. We back-date updatedAt past the 90s
  // active window so WhosHere + the admin active-count drop them
  // on the next poll instead of waiting for the window to expire
  // naturally.
  leaving: z.boolean().optional(),
});

export async function POST(req: Request, { params }: RouteCtx) {
  const { code } = await params;
  const room = await findRoomByCode(code);
  if (!room) return NextResponse.json({ ok: true });

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok: true });
  const { session, name, avatarId, vibe, seenAt, leaving } = parsed.data;

  const guard = await guardSession(session);
  if (guard) return guard;

  // Rate-limit at 4 heartbeats per minute per (room, session). The
  // client pings every 60s + on visibilitychange, so the steady-state
  // is 1/min; 4 leaves headroom for tab-focus thrash without letting
  // a misbehaving client (or a 200-viewer room) hammer the voters
  // upsert. Leave beacons skip the gate so a normal tab close still
  // lands its updatedAt back-date.
  if (!leaving) {
    const limited = await checkAndIncrement(
      `hb:${room.id}:${session}`,
      4,
      60_000,
    );
    if (!limited.ok) return NextResponse.json({ ok: true });
  }

  // Leave beacon: back-date updatedAt past the 90s active window so
  // WhosHere + admin active-count drop this session on their next
  // poll. We DON'T delete the row — the ballot / bets / chat
  // history all live on it, and the row's other consumers don't
  // care about updatedAt. If the same session comes back, the next
  // heartbeat upserts updatedAt forward and they reappear.
  if (leaving) {
    await db
      .update(voters)
      .set({ updatedAt: sql`now() - interval '5 minutes'` })
      .where(sql`${voters.roomId} = ${room.id} AND ${voters.sessionId} = ${session}`);
    return NextResponse.json({ ok: true });
  }

  // Upsert. The `name` column is NOT NULL — if this is the first
  // time we're seeing this session in this room AND they haven't
  // entered a name yet, skip the insert. They'll appear on the
  // next heartbeat after the name gate.
  if (!name) {
    // Best-effort touch for an existing row only.
    await db
      .update(voters)
      .set({
        updatedAt: sql`now()`,
        ...(avatarId !== undefined ? { avatarId } : {}),
        ...(vibe !== undefined ? { vibe } : {}),
        ...(seenAt !== undefined ? { seenAt: new Date(seenAt) } : {}),
      })
      .where(sql`${voters.roomId} = ${room.id} AND ${voters.sessionId} = ${session}`);
    return NextResponse.json({ ok: true });
  }

  await db
    .insert(voters)
    .values({
      roomId: room.id,
      sessionId: session,
      name,
      avatarId: avatarId ?? null,
      vibe: vibe ?? 0,
      seenAt: seenAt ? new Date(seenAt) : null,
    })
    .onConflictDoUpdate({
      target: [voters.roomId, voters.sessionId],
      set: {
        name,
        avatarId: avatarId ?? null,
        vibe: vibe ?? sql`${voters.vibe}`,
        seenAt: seenAt ? new Date(seenAt) : sql`${voters.seenAt}`,
        updatedAt: sql`now()`,
      },
    });

  return NextResponse.json({ ok: true });
}

export const dynamic = "force-dynamic";
