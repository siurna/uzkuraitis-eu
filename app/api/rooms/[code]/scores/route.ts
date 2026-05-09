import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { voters, votes } from "@/lib/db/schema";
import { findRoomByCode } from "@/lib/rooms";
import { countries } from "@/lib/countries";

type RouteCtx = { params: Promise<{ code: string }> };

export async function GET(_req: Request, { params }: RouteCtx) {
  const { code } = await params;
  const room = await findRoomByCode(code);
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  // Aggregate scores for this room only. Single roundtrip via raw SQL —
  // Drizzle's join+groupBy generates the same query, this is just leaner.
  const scoreRows = await db.execute<{
    country_code: string;
    total_points: number;
    points_12: number;
    points_10: number;
  }>(sql`
    SELECT
      v.country_code AS country_code,
      COALESCE(SUM(v.points), 0)::int AS total_points,
      SUM(CASE WHEN v.points = 12 THEN 1 ELSE 0 END)::int AS points_12,
      SUM(CASE WHEN v.points = 10 THEN 1 ELSE 0 END)::int AS points_10
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
      flag: c?.flag ?? "🏳️",
      totalPoints: r.total_points,
      points12: r.points_12,
      points10: r.points_10,
    };
  });

  // Recent voters in this room with their ballot, for the "votes cast" strip.
  const voterRows = await db
    .select({
      id: voters.id,
      name: voters.name,
      createdAt: voters.createdAt,
      points: votes.points,
      countryCode: votes.countryCode,
    })
    .from(voters)
    .leftJoin(votes, eq(votes.voterId, voters.id))
    .where(eq(voters.roomId, room.id));

  const voterMap = new Map<
    string,
    { id: string; name: string; createdAt: Date; votes: Record<string, string> }
  >();
  for (const r of voterRows) {
    if (!voterMap.has(r.id)) {
      voterMap.set(r.id, {
        id: r.id,
        name: r.name,
        createdAt: r.createdAt,
        votes: {},
      });
    }
    if (r.points !== null && r.countryCode !== null) {
      voterMap.get(r.id)!.votes[String(r.points)] = r.countryCode;
    }
  }

  const voterList = Array.from(voterMap.values()).sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );

  return NextResponse.json({
    room: {
      code: room.code,
      name: room.name,
      votingEnabled: room.votingEnabled,
    },
    scores,
    voters: voterList.map((v) => ({
      id: v.id,
      name: v.name,
      votes: v.votes,
    })),
  });
}
