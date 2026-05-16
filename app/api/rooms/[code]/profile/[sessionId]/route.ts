import { NextResponse } from "next/server";
import { eq, and, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  voters,
  votes,
  chatMessages,
  chatReactions,
  officialResults,
  roomResults,
  triviaAnswers,
} from "@/lib/db/schema";
import { findRoomByCode } from "@/lib/rooms";
import {
  scoreTopTenBreakdown,
  HIGHLIGHT_THRESHOLD,
  type Ballot,
  type TopTenPickBreakdown,
} from "@/lib/scoring";

// GET /api/rooms/<code>/profile/<sessionId>?as=<viewerSessionId>
//
// Read-only roll-up of a single participant: identity, chat activity,
// bingo strikes, the ballot (only after results are revealed, or to the
// participant themselves), and their hottest message of the night.
// Powers the ProfileSheet drawer.
//
// PERF: everything that can run independently fires in parallel via
// Promise.all. Was 9+ sequential roundtrips (a 1.5s wait); now bounded
// by the slowest single query. The slow path (ballot reveal) adds two
// more parallel calls but only when authorised — same fan-out, no
// wait-for-the-previous-result chain.

type RouteCtx = { params: Promise<{ code: string; sessionId: string }> };

export async function GET(req: Request, { params }: RouteCtx) {
  const { code, sessionId } = await params;
  const room = await findRoomByCode(code);
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  const viewer = new URL(req.url).searchParams.get("as") ?? "";
  const isSelf = viewer.length > 0 && viewer === sessionId;
  const canSeeBallot = room.tallyEnabled || isSelf;

  // PERF: every per-session query fans out in parallel. The previous
  // shape had 4 separate aggregations against chat_messages with the
  // same `(room_id, session_id)` filter — `messages`, `bingoStrikes`,
  // `latestMsg`, plus the message-id roll-up used by both
  // `highlightRows` and `topRow`. Those collapse into a single window
  // query that returns everything keyed on chat_messages.id; the
  // route then derives counts/highlight ids/top row in JS. Reduces
  // serverless DB round-trips from 9 to 5 on warm instances.
  type AuthoredRow = {
    id: string;
    body: string | null;
    gif_url: string | null;
    kind: string;
    created_at: string;
    name: string;
    avatar_id: string | null;
    reaction_count: number;
  };

  type BallotJoinRow = { points: number; country_code: string };

  const canMaybeSeeBallot = room.tallyEnabled || isSelf;

  // PERF: dropped the separate `reactions` query entirely. It used to
  // count reactionsGiven + reactionsReceived in one statement using an
  // OR across two different tables' columns — `r.session_id = X OR
  // m.session_id = X` — which the planner couldn't index and easily
  // ran ~500ms on a busy room. The profile UI never displayed
  // reactionsGiven (the admin per-room page computes that one
  // separately from its own bulk roll-up), so reactionsReceived is
  // now derived for free from `authoredRows.reaction_count` — we
  // already scan every message this session authored, so summing the
  // per-message counts is in-memory and zero RTT.
  const [
    voterRow,
    authoredRows,
    triviaStatsRow,
    ballotRows,
    overrideRows,
    globalRows,
  ] = await Promise.all([
    db
      .select()
      .from(voters)
      .where(and(eq(voters.roomId, room.id), eq(voters.sessionId, sessionId)))
      .limit(1)
      .then((rows) => rows[0]),
    db.execute<AuthoredRow>(sql`
      SELECT m.id,
             m.body,
             m.gif_url,
             m.kind,
             m.created_at,
             m.name,
             m.avatar_id,
             COUNT(r.message_id)::int AS reaction_count
      FROM ${chatMessages} m
      LEFT JOIN ${chatReactions} r ON r.message_id = m.id
      WHERE m.room_id = ${room.id}
        AND m.session_id = ${sessionId}
      GROUP BY m.id
    `),
    db
      .select({
        total: sql<number>`COUNT(*)::int`,
        correct: sql<number>`COUNT(*) FILTER (WHERE ${triviaAnswers.correct})::int`,
      })
      .from(triviaAnswers)
      .where(and(
        eq(triviaAnswers.roomId, room.id),
        eq(triviaAnswers.sessionId, sessionId),
      ))
      .then((rows) => rows[0]),
    // PERF: the ballot fan-out (ballot rows + room-override results +
    // global official results) used to fire AFTER the main Promise.all
    // resolved — a second RTT round adding ~300ms on warm instances.
    // Folded into the same batch by joining voters→votes inline so we
    // don't need the resolved voter id first. Skipped (resolved to [])
    // when the viewer isn't authorised to see the ballot, so we don't
    // waste cycles on profiles whose ballot the API would have hidden.
    canMaybeSeeBallot
      ? db.execute<BallotJoinRow>(sql`
          SELECT v2.points, v2.country_code
          FROM ${votes} v2
          INNER JOIN ${voters} vr ON vr.id = v2.voter_id
          WHERE vr.room_id = ${room.id} AND vr.session_id = ${sessionId}
        `)
      : Promise.resolve([] as BallotJoinRow[]),
    canMaybeSeeBallot
      ? db.select().from(roomResults).where(eq(roomResults.roomId, room.id))
      : Promise.resolve([] as { roomId: string; countryCode: string; placement: number }[]),
    canMaybeSeeBallot
      ? db.select().from(officialResults)
      : Promise.resolve([] as { countryCode: string; placement: number }[]),
  ]);

  // Derive the chat-roll-up shapes (messages, bingo strikes,
  // reactionsReceived, highlights, top + latest) from the single
  // authored-rows scan. reactionsReceived is just the sum of
  // per-message reaction counts — no extra DB hit.
  const messagesRow = { messages: authoredRows.length };
  const bingoStrikesRow = {
    bingoStrikes: authoredRows.filter((r) => r.kind === "bingo_strike").length,
  };
  const reactionsReceived = authoredRows.reduce(
    (sum, r) => sum + (r.reaction_count ?? 0),
    0,
  );
  // Per-room threshold override (falls back to the global default).
  const threshold = room.highlightThreshold ?? HIGHLIGHT_THRESHOLD;
  const highlightRows = authoredRows.filter(
    (r) => (r.reaction_count ?? 0) >= threshold,
  );
  const latestMsg = (() => {
    if (authoredRows.length === 0) return undefined;
    let best = authoredRows[0];
    for (const r of authoredRows) {
      if (new Date(r.created_at) > new Date(best.created_at)) best = r;
    }
    return {
      name: best.name,
      avatarId: best.avatar_id,
      createdAt: new Date(best.created_at),
    };
  })();
  const topRow = (() => {
    if (authoredRows.length === 0) return undefined;
    let best = authoredRows[0];
    for (const r of authoredRows) {
      if (
        (r.reaction_count ?? 0) > (best.reaction_count ?? 0) ||
        ((r.reaction_count ?? 0) === (best.reaction_count ?? 0) &&
          new Date(r.created_at) < new Date(best.created_at))
      ) {
        best = r;
      }
    }
    return {
      id: best.id,
      body: best.body,
      gifUrl: best.gif_url,
      kind: best.kind,
      reactionCount: best.reaction_count ?? 0,
    };
  })();

  if (!voterRow && !latestMsg) {
    return NextResponse.json({ error: "Unknown participant" }, { status: 404 });
  }

  const name = voterRow?.name ?? latestMsg?.name ?? "Anon";
  const avatarId = latestMsg?.avatarId ?? null;

  let betsPlaced = 0;
  if (voterRow) {
    const slots: Array<unknown> = [
      voterRow.betWoodenSpoon,
      voterRow.betLt12To,
      voterRow.betHighestBig5,
      voterRow.betJuryWinner,
      voterRow.betTelevoteWinner,
      voterRow.betNulTelevote && voterRow.betNulTelevote.length > 0 ? "x" : null,
      voterRow.betHostTop3,
      voterRow.betWinnerSolo,
      voterRow.betLtTotalPoints,
      voterRow.betLtJuryCount,
      voterRow.homeCountryPrediction,
    ];
    betsPlaced = slots.filter((v) => v !== null && v !== undefined).length;
  }

  // Per-pick ballot breakdown — only when authorised AND a voter row
  // exists. The data was fetched in the main Promise.all above so this
  // is a pure in-memory transform now (no extra RTT).
  let ballot: TopTenPickBreakdown[] | null = null;
  if (voterRow && canSeeBallot && ballotRows.length > 0) {
    const ballotObj: Ballot = {};
    for (const r of ballotRows) ballotObj[String(r.points)] = r.country_code;
    const placements: Record<string, number> =
      overrideRows.length > 0
        ? Object.fromEntries(overrideRows.map((r) => [r.countryCode, r.placement]))
        : Object.fromEntries(globalRows.map((r) => [r.countryCode, r.placement]));
    ballot = scoreTopTenBreakdown(ballotObj, placements);
  } else if (voterRow && canSeeBallot) {
    // Empty ballot but authorised — still render the scorecard with no
    // earned points so the comparison table is consistent.
    ballot = scoreTopTenBreakdown({}, {});
  }

  const res = NextResponse.json({
    sessionId,
    name,
    avatarId,
    joinedAt: voterRow?.createdAt ?? latestMsg?.createdAt ?? null,
    lastActiveAt: voterRow?.updatedAt ?? latestMsg?.createdAt ?? null,
    stats: {
      messages: messagesRow?.messages ?? 0,
      reactionsReceived,
      highlights: highlightRows.length,
      bingoStrikes: bingoStrikesRow?.bingoStrikes ?? 0,
      bets: betsPlaced,
      triviaCorrect: triviaStatsRow?.correct ?? 0,
      triviaTotal: triviaStatsRow?.total ?? 0,
    },
    ballot,
    ballotHidden: !!voterRow && !canSeeBallot,
    topHighlight: topRow && (topRow.reactionCount ?? 0) > 0
      ? {
          id: topRow.id,
          body: topRow.body,
          gifUrl: topRow.gifUrl,
          kind: topRow.kind,
          reactionCount: topRow.reactionCount,
        }
      : null,
  });
  // Browser-private 60s cache: repeat opens of the same profile during
  // a single show segment skip the network entirely. SWR in the sheet
  // doubles up so a stale browser cache still gets a silent revalidate.
  // `must-revalidate` keeps the cache off CDNs (would leak ballot data
  // across viewers) while letting the browser cache it for the viewer.
  res.headers.set("Cache-Control", "private, max-age=60, must-revalidate");
  return res;
}

export const dynamic = "force-dynamic";
