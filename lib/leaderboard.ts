import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  officialResults,
  officialFacts,
  roomResults,
  roomFacts,
  voters,
  votes,
  chatMessages,
  chatReactions,
  triviaAnswers,
} from "@/lib/db/schema";
import {
  scoreVoter,
  HIGHLIGHT_THRESHOLD,
  HIGHLIGHT_POINTS_PER,
  HIGHLIGHT_POINTS_MAX,
  type Ballot,
  type OfficialPlacements,
  type OfficialFacts,
  type Bets,
  type BetBreakdown,
} from "@/lib/scoring";
import { countries } from "@/lib/countries";
import { TRIVIA_POINTS } from "@/lib/trivia";

// Shared per-voter leaderboard computation — used by the /leaderboard
// API route AND by the "results are in" chat card. Per-room result
// overrides take precedence over the global official tables.

// Re-export for callers that already pull HIGHLIGHT_POINTS_MAX from this
// module (kept for compatibility while the dust settles).
export { HIGHLIGHT_POINTS_MAX };

export type LeaderboardRow = {
  voterId: string;
  sessionId: string;
  name: string;
  homePrediction: number | null;
  topTen: number;
  home: number;
  bets: BetBreakdown;
  /** Voter's actual bet picks — what they put down, so the UI can
   *  render a "you said / it was" comparison against `facts` /
   *  `placements`. */
  betPicks: Bets;
  betsTotal: number;
  /** Chat-highlights social bonus (already capped). */
  highlights: number;
  /** +2 per trivia question the player got right. */
  trivia: number;
  total: number;
};

export type RoomLeaderboard = {
  hasResults: boolean;
  tallyEnabled: boolean;
  homeCountryCode: string;
  homeCountryOfficialPlacement: number | null;
  /** Official placements (room override wins if set), so callers can
   *  render bet-pick comparisons without a separate request. */
  placements: OfficialPlacements;
  /** Official facts (room override wins if set). */
  facts: OfficialFacts;
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
    placements,
    facts,
  };
  if (!hasResults) {
    return { ...base, hasResults: false, leaderboard: [] };
  }

  // PERF: every per-room rollup fans out together. The earlier shape
  // was voterRows → ballotRows → highlightRows → triviaRows
  // sequentially, a 4-roundtrip waterfall; none of them depend on one
  // another (same room id, no shared state) so the latency is now
  // capped by the slowest single query instead of the sum.
  const [voterRows, ballotRows, highlightRows, triviaRows] = await Promise.all([
    db
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
      .where(eq(voters.roomId, room.id)),
    db
      .select({ voterId: votes.voterId, points: votes.points, countryCode: votes.countryCode })
      .from(votes)
      .innerJoin(voters, eq(voters.id, votes.voterId))
      .where(eq(voters.roomId, room.id)),
    db
      .select({
        sessionId: chatMessages.sessionId,
        reactionCount: sql<number>`count(${chatReactions.messageId})`,
      })
      .from(chatMessages)
      .leftJoin(chatReactions, eq(chatReactions.messageId, chatMessages.id))
      .where(eq(chatMessages.roomId, room.id))
      .groupBy(chatMessages.id, chatMessages.sessionId)
      .having(sql`count(${chatReactions.messageId}) >= ${HIGHLIGHT_THRESHOLD}`),
    db
      .select({
        sessionId: triviaAnswers.sessionId,
        hits: sql<number>`COUNT(*) FILTER (WHERE ${triviaAnswers.correct})::int`,
      })
      .from(triviaAnswers)
      .where(eq(triviaAnswers.roomId, room.id))
      .groupBy(triviaAnswers.sessionId),
  ]);

  const ballotByVoter = new Map<string, Ballot>();
  for (const r of ballotRows) {
    if (!ballotByVoter.has(r.voterId)) ballotByVoter.set(r.voterId, {});
    ballotByVoter.get(r.voterId)![String(r.points)] = r.countryCode;
  }

  const highlightCountBySession = new Map<string, number>();
  for (const r of highlightRows) {
    highlightCountBySession.set(r.sessionId, (highlightCountBySession.get(r.sessionId) ?? 0) + 1);
  }
  const highlightPoints = (sessionId: string) =>
    Math.min((highlightCountBySession.get(sessionId) ?? 0) * HIGHLIGHT_POINTS_PER, HIGHLIGHT_POINTS_MAX);

  const triviaPointsBySession = new Map<string, number>();
  for (const r of triviaRows) {
    triviaPointsBySession.set(r.sessionId, (r.hits ?? 0) * TRIVIA_POINTS);
  }
  const triviaPoints = (sessionId: string) => triviaPointsBySession.get(sessionId) ?? 0;

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
      const highlights = highlightPoints(v.sessionId);
      const trivia = triviaPoints(v.sessionId);
      return {
        voterId: v.id,
        sessionId: v.sessionId,
        name: v.name,
        homePrediction: v.homeCountryPrediction,
        topTen: score.topTen,
        home: score.home,
        bets: score.bets,
        betPicks: bets,
        betsTotal: score.betsTotal,
        highlights,
        trivia,
        total: score.total + highlights + trivia,
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
