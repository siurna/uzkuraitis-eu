import { NextResponse } from "next/server";
import { gt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { rooms, voters } from "@/lib/db/schema";
import { isAdminAuthed } from "@/lib/admin/session";

// GET /api/admin/rooms/active-counts — participant headcount per
// room, used by the /admin/live room picker badge. "Active" means
// the session pinged the heartbeat endpoint within the last 120s.
// The client (room-shell) pings every 60s + on visibilitychange,
// so a 120s window covers a single missed beat (background tab,
// network blip) without false-positive-ing a closed tab.
//
// The earlier revisions both missed the mark: the 2-minute
// `updatedAt` filter was tied to vote saves so it always read 0,
// and the lifetime COUNT was 100% over-counted (anyone who ever
// joined). The heartbeat path (added in /api/rooms/[code]/
// heartbeat) gives us a real signal without standing up a KV.
const ACTIVE_WINDOW_MS = 120_000;

export async function GET() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - ACTIVE_WINDOW_MS);

  const rows = await db
    .select({
      code: rooms.code,
      n: sql<number>`COUNT(${voters.id})::int`,
    })
    .from(rooms)
    .leftJoin(
      voters,
      sql`${voters.roomId} = ${rooms.id} AND ${gt(voters.updatedAt, cutoff)}`,
    )
    .groupBy(rooms.code);

  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.code] = r.n;
  return NextResponse.json({ counts });
}

export const dynamic = "force-dynamic";
