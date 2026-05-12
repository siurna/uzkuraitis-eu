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
import {
  scoreVoter,
  type Ballot,
  type OfficialPlacements,
  type OfficialFacts,
  type Bets,
  type BetBreakdown,
} from "@/lib/scoring";
import { countries } from "@/lib/countries";

// Shared per-voter leaderboard computation — used by the /leaderboard
// API route AND by the "results are in" chat card. Per-room result
// overrides take precedence over the global official tables.

export type LeaderboardRow = {
  voterId: string;
  sessionId: string;
  name: string;
  homePrediction: number | null;
  topTen: number;
  home: number;
  bets: BetBreakdown;
  betsTotal: number;
  total: number;
};

export type RoomLeaderboard = {
  hasResults: boolean;
  tallyEnabled: boolean;
  homeCountryCode: string;
  homeCountryOfficialPlacement: number | null;
  leaderboard: LeaderboardRow[];
};

export async function computeRoomLeaderboard(room: {
  id: string;
  homeCountryCode: string;
  tallyEnabled: boolean;
}): Promise<RoomLeaderboard> {
  const [officialRows, factRows, roomResultRows, roomFactRows] = await Promise.all([
    db.select().from(officialResults),
    db.select().from(officialFacts),
    db.select().from(roomResults).where(eq(roomResults.roomId, room.id)),
    db.select().from(roomFacts).where(eq(roomFacts.roomId, room.id)),
  ]);

  const placements: OfficialPlacements =
    roomResultRows.length > 0
      ? Object.fromEntries(roomResultRows.map((r) => [r.countryCode, r.placement]))
      : Object.fromEntries(officialRows.map((r) => [r.countryCode, r.placement]));
  const facts: OfficialFacts =
    roomFactRows.length > 0
      ? Object.fromEntries(roomFactRows.map((r) => [r.key, r.value]))
      : Object.fromEntries(factRows.map((r) => [r.key, r.value]));

  const anyResults =
    roomResultRows.length > 0 ||
    roomFactRows.length > 0 ||
    officialRows.length > 0 ||
    factRows.length > 0;
  const hasResults = anyResults && room.tallyEnabled;

  const base = {
    tallyEnabled: room.tallyEnabled,
    homeCountryCode: room.homeCountryCode,
    homeCountryOfficialPlacement: placements[room.homeCountryCode] ?? null,
  };
  if (!hasResults) {
    return { ...base, hasResults: false, leaderboard: [] };
  }

  const voterRows = await db
    .select({
      id: voters.id,
      sessionId: voters.sessionId,
      name: voters.name,
      homeCountryPrediction: voters.homeCountryPrediction,
      betWoodenSpoon: voters.betWoodenSpoon,
      betLt12To: voters.betLt12To,
      betHighestBig5: voters.betHighestBig5,
      betJuryWinner: voters.betJuryWinner,
      betTelevoteWinner: voters.betTelevoteWinner,
      betNulTelevote: voters.betNulTelevote,
      betHostTop3: voters.betHostTop3,
      betWinnerSolo: voters.betWinnerSolo,
      betLtTotalPoints: voters.betLtTotalPoints,
    })
    .from(voters)
    .where(eq(voters.roomId, room.id));

  const ballotRows = await db
    .select({ voterId: votes.voterId, points: votes.points, countryCode: votes.countryCode })
    .from(votes)
    .innerJoin(voters, eq(voters.id, votes.voterId))
    .where(eq(voters.roomId, room.id));

  const ballotByVoter = new Map<string, Ballot>();
  for (const r of ballotRows) {
    if (!ballotByVoter.has(r.voterId)) ballotByVoter.set(r.voterId, {});
    ballotByVoter.get(r.voterId)![String(r.points)] = r.countryCode;
  }

  const totalFinalists = countries.length;
  const officialHome = placements[room.homeCountryCode] ?? null;

  const leaderboard = voterRows
    .map((v) => {
      const bets: Bets = {
        woodenSpoon: v.betWoodenSpoon,
        lt12To: v.betLt12To,
        highestBig5: v.betHighestBig5,
        juryWinner: v.betJuryWinner,
        televoteWinner: v.betTelevoteWinner,
        nulTelevote: v.betNulTelevote,
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
        sessionId: v.sessionId,
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
      if (b.total !== a.total) return b.total - a.total;
      const aDiff =
        a.homePrediction != null && officialHome != null
          ? Math.abs(a.homePrediction - officialHome)
          : Infinity;
      const bDiff =
        b.homePrediction != null && officialHome != null
          ? Math.abs(b.homePrediction - officialHome)
          : Infinity;
      return aDiff - bDiff;
    });

  return { ...base, hasResults: true, leaderboard };
}
