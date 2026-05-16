import { NextResponse } from "next/server";
import { eq, sql, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { chatMessages, chatReactions } from "@/lib/db/schema";
import { findRoomByCode } from "@/lib/rooms";

// "Highlights of the evening" — the chat messages that collected enough
// reactions to be worth re-surfacing on the Home tab. Threshold is
// per-room (rooms.highlightThreshold, configurable from /admin) with
// a sensible 5-reaction default; the leaderboard + profile routes
// already honour the same column, this rail was hard-coded.
const DEFAULT_THRESHOLD = 5;
const LIMIT = 12;

type RouteCtx = { params: Promise<{ code: string }> };

export async function GET(_req: Request, { params }: RouteCtx) {
  const { code } = await params;
  const room = await findRoomByCode(code);
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });
  const threshold = room.highlightThreshold ?? DEFAULT_THRESHOLD;

  const reactionCount = sql<number>`count(${chatReactions.messageId})`;
  const rows = await db
    .select({
      id: chatMessages.id,
      name: chatMessages.name,
      avatarId: chatMessages.avatarId,
      kind: chatMessages.kind,
      body: chatMessages.body,
      gifUrl: chatMessages.gifUrl,
      meta: chatMessages.meta,
      createdAt: chatMessages.createdAt,
      reactionCount,
    })
    .from(chatMessages)
    .leftJoin(chatReactions, eq(chatReactions.messageId, chatMessages.id))
    .where(eq(chatMessages.roomId, room.id))
    .groupBy(chatMessages.id)
    .having(sql`count(${chatReactions.messageId}) >= ${threshold}`)
    .orderBy(desc(reactionCount), desc(chatMessages.createdAt))
    .limit(LIMIT);

  // PERF: highlights change on every reaction toggle but the visible
  // delta to viewers is tiny (a count tick on one message). 5s edge +
  // 30s SWR is plenty for a "best moments" rail; keeps the heavy
  // join+group+having out of the hot path.
  const res = NextResponse.json({
    highlights: rows.map((r) => ({ ...r, reactionCount: Number(r.reactionCount) })),
  });
  res.headers.set(
    "Cache-Control",
    "public, s-maxage=5, stale-while-revalidate=30",
  );
  return res;
}
