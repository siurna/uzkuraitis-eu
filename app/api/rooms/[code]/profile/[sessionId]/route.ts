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

  const [
    voterRow,
    authoredRows,
    reactionsGivenRow,
    reactionsReceivedRow,
    triviaStatsRow,
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
      .select({ reactionsGiven: sql<number>`COUNT(*)::int` })
      .from(chatReactions)
      .innerJoin(chatMessages, eq(chatMessages.id, chatReactions.messageId))
      .where(and(
        eq(chatMessages.roomId, room.id),
        eq(chatReactions.sessionId, sessionId),
      ))
      .then((rows) => rows[0]),
    db
      .select({ reactionsReceived: sql<number>`COUNT(*)::int` })
      .from(chatReactions)
      .innerJoin(chatMessages, eq(chatMessages.id, chatReactions.messageId))
      .where(and(
        eq(chatMessages.roomId, room.id),
        eq(chatMessages.sessionId, sessionId),
      ))
      .then((rows) => rows[0]),
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
  ]);

  // Derive the four chat-roll-up shapes the old query plan computed
  // separately from the single authored-rows scan.
  const messagesRow = { messages: authoredRows.length };
  const bingoStrikesRow = {
    bingoStrikes: authoredRows.filter((r) => r.kind === "bingo_strike").length,
  };
  const highlightRows = authoredRows.filter(
    (r) => (r.reaction_count ?? 0) >= HIGHLIGHT_THRESHOLD,
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
      voterRow.homeCountryPrediction,
    ];
    betsPlaced = slots.filter((v) => v !== null && v !== undefined).length;
  }

  // Ballot + per-pick breakdown — only when authorised. The ballot
  // rows and the placement tables fan out in parallel too.
  let ballot: TopTenPickBreakdown[] | null = null;
  if (voterRow && canSeeBallot) {
    const [ballotRows, overrideRows, globalRows] = await Promise.all([
      db
        .select({ points: votes.points, countryCode: votes.countryCode })
        .from(votes)
        .where(eq(votes.voterId, voterRow.id)),
      db.select().from(roomResults).where(eq(roomResults.roomId, room.id)),
      db.select().from(officialResults),
    ]);
    const ballotObj: Ballot = {};
    for (const r of ballotRows) ballotObj[String(r.points)] = r.countryCode;
    const placements: Record<string, number> =
      overrideRows.length > 0
        ? Object.fromEntries(overrideRows.map((r) => [r.countryCode, r.placement]))
        : Object.fromEntries(globalRows.map((r) => [r.countryCode, r.placement]));
    ballot = scoreTopTenBreakdown(ballotObj, placements);
  }

  return NextResponse.json({
    sessionId,
    name,
    avatarId,
    joinedAt: voterRow?.createdAt ?? latestMsg?.createdAt ?? null,
    lastActiveAt: voterRow?.updatedAt ?? latestMsg?.createdAt ?? null,
    stats: {
      messages: messagesRow?.messages ?? 0,
      reactionsGiven: reactionsGivenRow?.reactionsGiven ?? 0,
      reactionsReceived: reactionsReceivedRow?.reactionsReceived ?? 0,
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
}

export const dynamic = "force-dynamic";
