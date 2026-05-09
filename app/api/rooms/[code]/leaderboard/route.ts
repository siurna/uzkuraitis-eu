import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { officialResults, voters, votes } from "@/lib/db/schema";
import { findRoomByCode } from "@/lib/rooms";
import { scoreVoter, type Ballot, type OfficialPlacements } from "@/lib/scoring";

type RouteCtx = { params: Promise<{ code: string }> };

// Compute the per-voter leaderboard for a room. Returns the result-or-empty
// shape so the UI can render a "waiting for results" state without a
// separate request.
export async function GET(_req: Request, { params }: RouteCtx) {
  const { code } = await params;
  const room = await findRoomByCode(code);
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  // Load the global official result (if any).
  const officialRows = await db.select().from(officialResults);
  const placements: OfficialPlacements = Object.fromEntries(
    officialRows.map((r) => [r.countryCode, r.placement]),
  );
  const hasResults = officialRows.length > 0;

  if (!hasResults) {
    return NextResponse.json({
      hasResults: false,
      homeCountryCode: room.homeCountryCode,
      leaderboard: [],
    });
  }

  // Pull every voter and their full ballot for this room.
  const rows = await db
    .select({
      id: voters.id,
      name: voters.name,
      homeCountryPrediction: voters.homeCountryPrediction,
      points: votes.points,
      countryCode: votes.countryCode,
    })
    .from(voters)
    .leftJoin(votes, eq(votes.voterId, voters.id))
    .where(eq(voters.roomId, room.id));

  type Agg = {
    id: string;
    name: string;
    homePrediction: number | null;
    ballot: Ballot;
  };
  const byVoter = new Map<string, Agg>();
  for (const r of rows) {
    if (!byVoter.has(r.id)) {
      byVoter.set(r.id, {
        id: r.id,
        name: r.name,
        homePrediction: r.homeCountryPrediction ?? null,
        ballot: {},
      });
    }
    if (r.points != null && r.countryCode != null) {
      byVoter.get(r.id)!.ballot[String(r.points)] = r.countryCode;
    }
  }

  const leaderboard = Array.from(byVoter.values())
    .map((v) => {
      const score = scoreVoter({
        ballot: v.ballot,
        homeCountryCode: room.homeCountryCode,
        homePrediction: v.homePrediction,
        officialPlacements: placements,
      });
      return {
        voterId: v.id,
        name: v.name,
        homePrediction: v.homePrediction,
        topTen: score.topTen,
        home: score.home,
        total: score.total,
      };
    })
    .sort((a, b) => b.total - a.total);

  return NextResponse.json({
    hasResults: true,
    homeCountryCode: room.homeCountryCode,
    homeCountryOfficialPlacement: placements[room.homeCountryCode] ?? null,
    leaderboard,
  });
}
