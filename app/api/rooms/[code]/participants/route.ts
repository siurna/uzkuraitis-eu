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
  // Browser cache up to 15s + CDN cache 15s + stale-while-revalidate
  // 30s. The WhosHere poller targets ~20s, so most polls in a
  // sustained-traffic room will short-circuit at the CDN before the
  // request ever reaches Postgres. Was max-age=3 — too short to
  // catch the steady-state poll cadence with 100+ viewers all
  // hitting the endpoint within the same 20s window.
  res.headers.set(
    "Cache-Control",
    "private, max-age=15, s-maxage=15, stale-while-revalidate=30",
  );
  return res;
}

export const dynamic = "force-dynamic";
