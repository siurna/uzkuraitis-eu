import { NextResponse } from "next/server";
import { and, eq, gt, isNotNull, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { voters } from "@/lib/db/schema";
import { findRoomByCode } from "@/lib/rooms";

// Participants currently in the room — drives WhosHere. Reads from
// the voters table (populated by the heartbeat endpoint) rather
// than Supabase Realtime presence. Single source of truth for
// "who is here", no per-client rate limit, no presence_diff
// fragility.
//
// "Currently here" cutoff is 90s — covers a missed heartbeat
// (60s cadence + buffer) without false-positive-ing a closed tab.
// Returns only voters who have entered a name (passed the welcome
// gate); the row is created by the heartbeat upsert but the
// WhosHere honeycomb shouldn't render nameless tiles.

type RouteCtx = { params: Promise<{ code: string }> };

const ACTIVE_WINDOW_MS = 90_000;

export async function GET(_req: Request, { params }: RouteCtx) {
  const { code } = await params;
  const room = await findRoomByCode(code);
  if (!room) {
    return NextResponse.json({ participants: [] });
  }

  const cutoff = new Date(Date.now() - ACTIVE_WINDOW_MS);

  const rows = await db
    .select({
      sessionId: voters.sessionId,
      name: voters.name,
      avatarId: voters.avatarId,
      vibe: voters.vibe,
      seenAt: voters.seenAt,
      updatedAt: voters.updatedAt,
    })
    .from(voters)
    .where(
      and(
        eq(voters.roomId, room.id),
        gt(voters.updatedAt, cutoff),
        isNotNull(voters.name),
      ),
    )
    .orderBy(desc(voters.updatedAt));

  const res = NextResponse.json({
    participants: rows.map((r) => ({
      sessionId: r.sessionId,
      name: r.name,
      avatarId: r.avatarId,
      vibe: r.vibe ?? 0,
      seenAt: r.seenAt ? r.seenAt.toISOString() : null,
      updatedAt: r.updatedAt.toISOString(),
    })),
  });
  // Tiny private cache so a tab that hops between rooms / refocuses
  // doesn't pay an extra round trip if the previous fetch is <3s old.
  // The WhosHere poller targets a 20s cadence anyway, so this only
  // helps the rare "two consumers within the same window" case.
  res.headers.set(
    "Cache-Control",
    "private, max-age=3, stale-while-revalidate=10",
  );
  return res;
}

export const dynamic = "force-dynamic";
