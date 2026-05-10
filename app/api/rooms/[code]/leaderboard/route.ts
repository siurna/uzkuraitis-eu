import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  officialResults,
  officialFacts,
  roomResults,
  roomFacts,
  voters,
  votes,
} from "@/lib/db/schema";
import { findRoomByCode } from "@/lib/rooms";
import {
  scoreVoter,
  type Ballot,
  type OfficialPlacements,
  type OfficialFacts,
  type Bets,
} from "@/lib/scoring";
import { countries } from "@/lib/countries";

type RouteCtx = { params: Promise<{ code: string }> };

// Compute the per-voter leaderboard for a room. Returns "waiting" shape if
// no official result has been entered yet so the UI doesn't have to make
// a separate request.
export async function GET(_req: Request, { params }: RouteCtx) {
  const { code } = await params;
  const room = await findRoomByCode(code);
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  // Per-room overrides take precedence; if the room has any rows we use
  // those exclusively. Otherwise fall back to the global official tables.
  const [
    officialRows,
    factRows,
    roomResultRows,
    roomFactRows,
  ] = await Promise.all([
    db.select().from(officialResults),
    db.select().from(officialFacts),
    db.select().from(roomResults).where(eq(roomResults.roomId, room.id)),
    db.select().from(roomFacts).where(eq(roomFacts.roomId, room.id)),
  ]);

  const placements: OfficialPlacements =
    roomResultRows.length > 0
      ? Object.fromEntries(
          roomResultRows.map((r) => [r.countryCode, r.placement]),
        )
      : Object.fromEntries(
          officialRows.map((r) => [r.countryCode, r.placement]),
        );
  const facts: OfficialFacts =
    roomFactRows.length > 0
      ? Object.fromEntries(roomFactRows.map((r) => [r.key, r.value]))
      : Object.fromEntries(factRows.map((r) => [r.key, r.value]));
  // Two gates: (a) some results exist (else nothing to score against),
  // (b) the room admin has flipped the "tally up bets" toggle on. Either
  // gate failing hides the leaderboard entirely.
  const anyResults =
    roomResultRows.length > 0 ||
    roomFactRows.length > 0 ||
    officialRows.length > 0 ||
    factRows.length > 0;
  const hasResults = anyResults && room.tallyEnabled;

  if (!hasResults) {
    return NextResponse.json({
      hasResults: false,
      tallyEnabled: room.tallyEnabled,
      homeCountryCode: room.homeCountryCode,
      leaderboard: [],
    });
  }

  // Pull every voter, their ballots, and their side bets in one go.
  const voterRows = await db
    .select({
      id: voters.id,
      name: voters.name,
      homeCountryPrediction: voters.homeCountryPrediction,
      betWoodenSpoon: voters.betWoodenSpoon,
      betLt12To: voters.betLt12To,
      betHighestBig5: voters.betHighestBig5,
      betJuryWinner: voters.betJuryWinner,
      betTelevoteWinner: voters.betTelevoteWinner,
      betNulTelevote: voters.betNulTelevote,
      betSameWinners: voters.betSameWinners,
      betHostTop3: voters.betHostTop3,
      betWinnerSolo: voters.betWinnerSolo,
      betLtTotalPoints: voters.betLtTotalPoints,
    })
    .from(voters)
    .where(eq(voters.roomId, room.id));

  const ballotRows = await db
    .select({
      voterId: votes.voterId,
      points: votes.points,
      countryCode: votes.countryCode,
    })
    .from(votes)
    .innerJoin(voters, eq(voters.id, votes.voterId))
    .where(eq(voters.roomId, room.id));

  const ballotByVoter = new Map<string, Ballot>();
  for (const r of ballotRows) {
    if (!ballotByVoter.has(r.voterId)) ballotByVoter.set(r.voterId, {});
    ballotByVoter.get(r.voterId)![String(r.points)] = r.countryCode;
  }

  const totalFinalists = countries.length;

  const leaderboard = voterRows
    .map((v) => {
      const bets: Bets = {
        woodenSpoon: v.betWoodenSpoon,
        lt12To: v.betLt12To,
        highestBig5: v.betHighestBig5,
        juryWinner: v.betJuryWinner,
        televoteWinner: v.betTelevoteWinner,
        nulTelevote: v.betNulTelevote,
        sameWinners: v.betSameWinners,
        hostTop3: v.betHostTop3,
        winnerSolo: v.betWinnerSolo,
        ltTotalPoints: v.betLtTotalPoints,
      };
      const score = scoreVoter({
        ballot: ballotByVoter.get(v.id) ?? {},
        homeCountryCode: room.homeCountryCode,
        homePrediction: v.homeCountryPrediction,
        bets,
        officialPlacements: placements,
        facts,
        totalFinalists,
      });
      return {
        voterId: v.id,
        name: v.name,
        homePrediction: v.homeCountryPrediction,
        topTen: score.topTen,
        home: score.home,
        bets: score.bets,
        betsTotal: score.betsTotal,
        total: score.total,
      };
    })
    .sort((a, b) => {
      // Primary: total desc.
      if (b.total !== a.total) return b.total - a.total;
      // Tie-break: closer home prediction wins.
      const aDiff =
        a.homePrediction != null && placements[room.homeCountryCode] != null
          ? Math.abs(a.homePrediction - placements[room.homeCountryCode]!)
          : Infinity;
      const bDiff =
        b.homePrediction != null && placements[room.homeCountryCode] != null
          ? Math.abs(b.homePrediction - placements[room.homeCountryCode]!)
          : Infinity;
      return aDiff - bDiff;
    });

  return NextResponse.json({
    hasResults: true,
    homeCountryCode: room.homeCountryCode,
    homeCountryOfficialPlacement: placements[room.homeCountryCode] ?? null,
    leaderboard,
  });
}
