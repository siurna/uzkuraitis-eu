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
} from "@/lib/db/schema";
import { findRoomByCode } from "@/lib/rooms";
import {
  scoreTopTenBreakdown,
  type Ballot,
  type TopTenPickBreakdown,
} from "@/lib/scoring";

// GET /api/rooms/<code>/profile/<sessionId>?as=<viewerSessionId>
//
// Read-only roll-up of a single participant: identity, chat activity,
// bingo strikes, the ballot (only after results are revealed, or to the
// participant themselves), and their hottest message of the night.
// Powers the ProfileSheet drawer that opens from the Who's-Here bubbles
// and chat avatars.

type RouteCtx = { params: Promise<{ code: string; sessionId: string }> };

const HIGHLIGHT_THRESHOLD = 5;

export async function GET(req: Request, { params }: RouteCtx) {
  const { code, sessionId } = await params;
  const room = await findRoomByCode(code);
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  const viewer = new URL(req.url).searchParams.get("as") ?? "";
  const isSelf = viewer.length > 0 && viewer === sessionId;
  // The ballot stays hidden until the host has revealed results — except
  // to the voter themselves, who already knows their own picks.
  const canSeeBallot = room.tallyEnabled || isSelf;

  // Voter row (only present if they've cast a ballot)
  const [voterRow] = await db
    .select()
    .from(voters)
    .where(and(eq(voters.roomId, room.id), eq(voters.sessionId, sessionId)))
    .limit(1);

  // Latest chat message — gives us the display name + avatar even for
  // participants who joined the chat but never voted.
  const [latestMsg] = await db
    .select({
      name: chatMessages.name,
      avatarId: chatMessages.avatarId,
      createdAt: chatMessages.createdAt,
    })
    .from(chatMessages)
    .where(and(eq(chatMessages.roomId, room.id), eq(chatMessages.sessionId, sessionId)))
    .orderBy(desc(chatMessages.createdAt))
    .limit(1);

  if (!voterRow && !latestMsg) {
    return NextResponse.json({ error: "Unknown participant" }, { status: 404 });
  }

  const name = voterRow?.name ?? latestMsg?.name ?? "Anon";
  const avatarId = latestMsg?.avatarId ?? null;

  // Aggregate counters — each O(rows for this session) thanks to the
  // chat_room_created_idx + chat_react_msg_idx indexes.
  const [{ messages }] = await db
    .select({ messages: sql<number>`COUNT(*)::int` })
    .from(chatMessages)
    .where(and(eq(chatMessages.roomId, room.id), eq(chatMessages.sessionId, sessionId)));

  const [{ reactionsGiven }] = await db
    .select({ reactionsGiven: sql<number>`COUNT(*)::int` })
    .from(chatReactions)
    .innerJoin(chatMessages, eq(chatMessages.id, chatReactions.messageId))
    .where(and(
      eq(chatMessages.roomId, room.id),
      eq(chatReactions.sessionId, sessionId),
    ));

  const [{ reactionsReceived }] = await db
    .select({ reactionsReceived: sql<number>`COUNT(*)::int` })
    .from(chatReactions)
    .innerJoin(chatMessages, eq(chatMessages.id, chatReactions.messageId))
    .where(and(
      eq(chatMessages.roomId, room.id),
      eq(chatMessages.sessionId, sessionId),
    ));

  // Highlights — messages this session authored that crossed the
  // reaction threshold. Same rule the leaderboard's social bonus uses.
  const highlightRows = await db
    .select({
      id: chatMessages.id,
      reactionCount: sql<number>`COUNT(${chatReactions.messageId})::int`,
    })
    .from(chatMessages)
    .leftJoin(chatReactions, eq(chatReactions.messageId, chatMessages.id))
    .where(and(eq(chatMessages.roomId, room.id), eq(chatMessages.sessionId, sessionId)))
    .groupBy(chatMessages.id)
    .having(sql`COUNT(${chatReactions.messageId}) >= ${HIGHLIGHT_THRESHOLD}`);

  const [{ bingoStrikes }] = await db
    .select({ bingoStrikes: sql<number>`COUNT(*)::int` })
    .from(chatMessages)
    .where(and(
      eq(chatMessages.roomId, room.id),
      eq(chatMessages.sessionId, sessionId),
      eq(chatMessages.kind, "bingo_strike"),
    ));

  // The hottest message they authored — drives the "top moment" chip.
  const [topRow] = await db
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
    .limit(1);

  // Count how many bet slots the voter has filled (the home-country
  // placement guess sits in voters.homeCountryPrediction).
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

  // Ballot + per-pick breakdown — only when authorised.
  let ballot: TopTenPickBreakdown[] | null = null;
  if (voterRow && canSeeBallot) {
    const ballotRows = await db
      .select({ points: votes.points, countryCode: votes.countryCode })
      .from(votes)
      .where(eq(votes.voterId, voterRow.id));
    const ballotObj: Ballot = {};
    for (const r of ballotRows) ballotObj[String(r.points)] = r.countryCode;

    // Per-room overrides take precedence over the global result table.
    const [overrideRows, globalRows] = await Promise.all([
      db.select().from(roomResults).where(eq(roomResults.roomId, room.id)),
      db.select().from(officialResults),
    ]);
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
      messages: messages ?? 0,
      reactionsGiven: reactionsGiven ?? 0,
      reactionsReceived: reactionsReceived ?? 0,
      highlights: highlightRows.length,
      bingoStrikes: bingoStrikes ?? 0,
      bets: betsPlaced,
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
