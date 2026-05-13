import { NextResponse } from "next/server";
import { eq, and, sql, desc } from "drizzle-orm";
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

  // Fan out every per-session query in parallel. None of these depend
  // on each other — the room id is already in hand and the queries
  // share no intermediate state.
  const [
    voterRow,
    latestMsg,
    messagesRow,
    reactionsGivenRow,
    reactionsReceivedRow,
    highlightRows,
    bingoStrikesRow,
    triviaStatsRow,
    topRow,
  ] = await Promise.all([
    db
      .select()
      .from(voters)
      .where(and(eq(voters.roomId, room.id), eq(voters.sessionId, sessionId)))
      .limit(1)
      .then((rows) => rows[0]),
    db
      .select({
        name: chatMessages.name,
        avatarId: chatMessages.avatarId,
        createdAt: chatMessages.createdAt,
      })
      .from(chatMessages)
      .where(and(eq(chatMessages.roomId, room.id), eq(chatMessages.sessionId, sessionId)))
      .orderBy(desc(chatMessages.createdAt))
      .limit(1)
      .then((rows) => rows[0]),
    db
      .select({ messages: sql<number>`COUNT(*)::int` })
      .from(chatMessages)
      .where(and(eq(chatMessages.roomId, room.id), eq(chatMessages.sessionId, sessionId)))
      .then((rows) => rows[0]),
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
        id: chatMessages.id,
        reactionCount: sql<number>`COUNT(${chatReactions.messageId})::int`,
      })
      .from(chatMessages)
      .leftJoin(chatReactions, eq(chatReactions.messageId, chatMessages.id))
      .where(and(eq(chatMessages.roomId, room.id), eq(chatMessages.sessionId, sessionId)))
      .groupBy(chatMessages.id)
      .having(sql`COUNT(${chatReactions.messageId}) >= ${HIGHLIGHT_THRESHOLD}`),
    db
      .select({ bingoStrikes: sql<number>`COUNT(*)::int` })
      .from(chatMessages)
      .where(and(
        eq(chatMessages.roomId, room.id),
        eq(chatMessages.sessionId, sessionId),
        eq(chatMessages.kind, "bingo_strike"),
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
    db
      .select({
        id: chatMessages.id,
        body: chatMessages.body,
        gifUrl: chatMessages.gifUrl,
        kind: chatMessages.kind,
        reactionCount: sql<number>`COUNT(${chatReactions.messageId})::int`,
      })
      .from(chatMessages)
      .leftJoin(chatReactions, eq(chatReactions.messageId, chatMessages.id))
      .where(and(eq(chatMessages.roomId, room.id), eq(chatMessages.sessionId, sessionId)))
      .groupBy(chatMessages.id)
      .orderBy(sql`COUNT(${chatReactions.messageId}) DESC, ${chatMessages.createdAt} ASC`)
      .limit(1)
      .then((rows) => rows[0]),
  ]);

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
