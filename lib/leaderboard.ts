import { and, eq, notInArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { broadcastToRoom } from "@/lib/realtime-server";
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
  precomputeScoringContext,
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

// "Price is Right" tiebreaker score for the LT-total-points guess.
// Smaller is better. The voter whose guess is closest WITHOUT going
// over wins; anyone who went over is ordered AFTER anyone who didn't,
// regardless of how close. Missing inputs (no truth set, no guess
// from the voter) collapse to +Infinity so they're ordered last among
// tied scores. The 1e6 penalty for over-bids gives us plenty of
// headroom over realistic |truth - guess| values (LT totals top out
// near 600, so the under-bid distance is at most ~600 and over-bids
// can be ordered by distance within their own group without colliding
// with under-bids).
function priceIsRight(guess: number | null, truth: number | null): number {
  if (truth == null) return Infinity;
  if (guess == null) return Infinity;
  if (guess > truth) return 1_000_000 + (guess - truth);
  return truth - guess;
}

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

// SHOW-DAY HOTPATCH: in-memory per-Lambda cache of the computed
// leaderboard. The endpoint was timing out (>60s) under climax load
// — many viewers + admin retallies + the chat-message × reactions
// JOIN aggregate (highlights) all hitting the same compute path.
// Vercel's CDN dedups concurrent requests for the same URL but only
// AFTER the first compute finishes; if the first compute hangs, all
// the queued viewers timeout together. Warm Lambdas can now return
// from RAM in <1ms for `LEADERBOARD_TTL_MS` after a successful
// compute, which buys time even when the CDN cache is cold or
// being revalidated. Cache is best-effort — the durable data
// still lives in Postgres and the response shape is identical to
// a fresh compute.
const LEADERBOARD_TTL_MS = 30_000;
const inflight = new Map<string, Promise<RoomLeaderboard>>();
const memo = new Map<string, { result: RoomLeaderboard; expiresAt: number }>();

export function bustRoomLeaderboardCache(roomId: string): void {
  memo.delete(roomId);
  inflight.delete(roomId);
}

// Admin-side write helper. After any change that affects the
// leaderboard (results entered, facts entered, tally toggled),
// call this instead of broadcasting `leaderboard:updated` directly:
//   * busts THIS Lambda's memo so the admin's own subsequent reads
//     are fresh
//   * fires a background recompute (no await) so the memo is hot
//     for the wave of client refetches that lands ~1-2s later via
//     the broadcast
//   * sends the `leaderboard:updated` broadcast for clients to act on
//
// Caveats: only this Lambda's memo is busted; other warm Lambdas
// keep their (stale) memo for up to LEADERBOARD_TTL_MS. The edge
// cache (s-maxage on the GET route) is also a separate layer with
// its own TTL. For mid-show this is acceptable — admin reveals
// settle within ~15s for all viewers.
export async function broadcastLeaderboardUpdate(room: {
  id: string;
  code: string;
  homeCountryCode: string;
  tallyEnabled: boolean;
  highlightThreshold: number | null;
}): Promise<void> {
  bustRoomLeaderboardCache(room.id);
  // Fire-and-forget: kick off the recompute now so the Lambda memo
  // is hot by the time clients refetch via the broadcast event.
  // We don't await it — the broadcast must go out ASAP so clients
  // see the "new results" signal immediately.
  void computeRoomLeaderboard(room).catch(() => {
    /* compute will be retried by the next client fetch */
  });
  await broadcastToRoom(room.code, { type: "leaderboard:updated" });
}

export async function computeRoomLeaderboard(room: {
  id: string;
  homeCountryCode: string;
  tallyEnabled: boolean;
  /** Per-room override; falls back to global HIGHLIGHT_THRESHOLD. */
  highlightThreshold?: number | null;
}): Promise<RoomLeaderboard> {
  const cached = memo.get(room.id);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }
  // Single-flight: if a compute is already in flight for this room
  // on this Lambda, wait for it instead of starting another one.
  const pending = inflight.get(room.id);
  if (pending) return pending;
  const promise = computeRoomLeaderboardImpl(room).then((result) => {
    memo.set(room.id, { result, expiresAt: Date.now() + LEADERBOARD_TTL_MS });
    inflight.delete(room.id);
    return result;
  }, (err) => {
    inflight.delete(room.id);
    throw err;
  });
  inflight.set(room.id, promise);
  return promise;
}

async function computeRoomLeaderboardImpl(room: {
  id: string;
  homeCountryCode: string;
  tallyEnabled: boolean;
  highlightThreshold?: number | null;
}): Promise<RoomLeaderboard> {
  const threshold = room.highlightThreshold ?? HIGHLIGHT_THRESHOLD;
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
        betLtJuryCount: voters.betLtJuryCount,
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
      // System / commentator bot authorships never qualify as
      // highlights, mirrors the /highlights rail filter.
      .where(
        and(
          eq(chatMessages.roomId, room.id),
          notInArray(chatMessages.sessionId, ["system", "commentator"]),
        ),
      )
      .groupBy(chatMessages.id, chatMessages.sessionId)
      .having(sql`count(${chatReactions.messageId}) >= ${threshold}`),
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

  // PERF: hoist the scoring context out of the per-voter loop. The
  // maps inside `ScoringContext` (officialTop10, placementToCountry,
  // bestBig5, nulTrueSet, …) depend only on the room-level facts +
  // placements, not on any voter. Building them once instead of
  // once-per-voter is the cheapest leaderboard-compute win we have
  // for a 50+ person room.
  const scoringCtx = precomputeScoringContext(
    placements,
    facts,
    totalFinalists,
    room.homeCountryCode,
  );

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
        ltJuryCount: v.betLtJuryCount,
      };
      const score = scoreVoter({
        ballot: ballotByVoter.get(v.id) ?? {},
        homeCountryCode: room.homeCountryCode,
        homePrediction: v.homeCountryPrediction,
        bets,
        officialPlacements: placements,
        facts,
        totalFinalists,
        ctx: scoringCtx,
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
      // Tiebreaker 1: Price-is-Right on LT total points. The voter
      // whose `bet_lt_total_points` guess is closest WITHOUT going
      // over the truth wins. A guess > truth ("you bid 350, LT got
      // 280") loses to any guess <= truth, even by a wide margin —
      // same rule the TV show uses. No guess at all loses to anyone
      // with a guess. No truth set yet → tiebreaker collapses.
      const truth = scoringCtx.ltTotalTruth;
      const aPir = priceIsRight(a.betPicks.ltTotalPoints ?? null, truth);
      const bPir = priceIsRight(b.betPicks.ltTotalPoints ?? null, truth);
      if (aPir !== bPir) return aPir - bPir;
      // Tiebreaker 2 (fallback): closest home-country placement.
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
