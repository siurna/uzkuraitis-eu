import { NextResponse } from "next/server";
import { gt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { rooms, voters } from "@/lib/db/schema";
import { isAdminAuthed } from "@/lib/admin/session";

// GET /api/admin/rooms/active-counts — live headcount per room, used by
// the /admin/live room picker badge. Single grouped query against the
// voters table on the same 2-minute "recently active" window the page-
// load aggregate uses, so the polled value lines up with the initial
// SSR paint. Returned shape: `{ counts: { [roomCode]: number } }`.
export async function GET() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const ACTIVE_WINDOW_MS = 2 * 60 * 1000;
  const activeSince = new Date(Date.now() - ACTIVE_WINDOW_MS);

  const rows = await db
    .select({
      code: rooms.code,
      n: sql<number>`COUNT(${voters.id})::int`,
    })
    .from(rooms)
    .leftJoin(voters, sql`${voters.roomId} = ${rooms.id} AND ${gt(voters.updatedAt, activeSince)}`)
    .groupBy(rooms.code);

  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.code] = r.n;
  return NextResponse.json({ counts });
}

export const dynamic = "force-dynamic";
