import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { rooms, voters } from "@/lib/db/schema";
import { isAdminAuthed } from "@/lib/admin/session";

// GET /api/admin/rooms/active-counts — participant headcount per
// room, used by the /admin/live room picker badge. The earlier
// implementation counted "voters updated in the last 2 minutes"
// but `voters.updatedAt` only bumps on a vote/bet save, so a room
// full of passive watchers always reported zero and the badge
// silently disappeared. This now returns the count of voters who
// have ever joined the room — the most useful "people in this room"
// signal for the host. Polling at 15s gives the real-time feel.
export async function GET() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const rows = await db
    .select({
      code: rooms.code,
      n: sql<number>`COUNT(${voters.id})::int`,
    })
    .from(rooms)
    .leftJoin(voters, sql`${voters.roomId} = ${rooms.id}`)
    .groupBy(rooms.code);

  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.code] = r.n;
  return NextResponse.json({ counts });
}

export const dynamic = "force-dynamic";
