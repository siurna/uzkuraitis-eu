import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { voters } from "@/lib/db/schema";
import { findRoomByCode } from "@/lib/rooms";
import { guardSession } from "@/lib/server-session";

// Tiny heartbeat endpoint. The room shell pings this every minute
// (and on visibilitychange when the tab returns) so the server has
// an accurate "actively in the room" signal for the admin Live
// page's active-count badge. Without it, the badge could only fall
// back to lifetime voters-joined, which over-counts everyone who
// ever opened the room.
//
// Cheap UPDATE — one row by `(roomId, sessionId)` (covered by the
// `voters_room_session_unique` index). No insert path: a session
// that hasn't joined yet has no voter row to bump, and that's
// fine; it'll be created the moment they cast a ballot or open
// chat. Returns 200 either way so the client doesn't retry.

type RouteCtx = { params: Promise<{ code: string }> };

const BodySchema = z.object({
  session: z.string().min(8).max(64),
});

export async function POST(req: Request, { params }: RouteCtx) {
  const { code } = await params;
  const room = await findRoomByCode(code);
  if (!room) return NextResponse.json({ ok: true });

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok: true });
  const { session } = parsed.data;

  const guard = await guardSession(session);
  if (guard) return guard;

  await db
    .update(voters)
    .set({ updatedAt: sql`now()` })
    .where(and(eq(voters.roomId, room.id), eq(voters.sessionId, session)));

  return NextResponse.json({ ok: true });
}

export const dynamic = "force-dynamic";
