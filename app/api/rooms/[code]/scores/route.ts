import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { voters, votes } from "@/lib/db/schema";
import { findRoomByCode } from "@/lib/rooms";
import { countries } from "@/lib/countries";

type RouteCtx = { params: Promise<{ code: string }> };

// Aggregate room scores. One SUM-per-country roundtrip + a join to
// scope by room. The 12/10-tiebreaker columns are no longer rendered
// anywhere, dropped.
export async function GET(_req: Request, { params }: RouteCtx) {
  const { code } = await params;
  const room = await findRoomByCode(code);
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const scoreRows = await db.execute<{
    country_code: string;
    total_points: number;
  }>(sql`
    SELECT
      v.country_code AS country_code,
      COALESCE(SUM(v.points), 0)::int AS total_points
    FROM ${votes} v
    INNER JOIN ${voters} vt ON vt.id = v.voter_id
    WHERE vt.room_id = ${room.id}
    GROUP BY v.country_code
    ORDER BY total_points DESC
  `);

  const scores = scoreRows.rows.map((r) => {
    const c = countries.find((c) => c.code === r.country_code);
    return {
      code: r.country_code,
      name: c?.name ?? r.country_code,
      totalPoints: r.total_points,
    };
  });

  return NextResponse.json({
    room: {
      code: room.code,
      name: room.name,
      votingEnabled: room.votingEnabled,
    },
    scores,
  });
}
