import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { chatMessages, chatReactions } from "@/lib/db/schema";
import { findRoomByCode } from "@/lib/rooms";
import { broadcastToRoom } from "@/lib/realtime-server";
import { guardSession } from "@/lib/server-session";
import { checkAndIncrement } from "@/lib/rate-limit";

// Toggle a reaction: if (msg, session, emoji) exists, delete it;
// otherwise insert. Returns ok:true with `added` so clients can update
// optimistically. Broadcasts chat:react regardless of which path was
// taken — listeners just refetch the message's reactions.

type RouteCtx = { params: Promise<{ code: string; id: string }> };

const ReactSchema = z.object({
  session: z.string().min(8).max(64),
  name: z.string().trim().min(1).max(40),
  emoji: z.string().min(1).max(8),
});

export async function POST(req: Request, { params }: RouteCtx) {
  const { code, id } = await params;
  const room = await findRoomByCode(code);
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  const parsed = ReactSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { session, name, emoji } = parsed.data;

  const guard = await guardSession(session);
  if (guard) return guard;

  // 60 reactions/min per session — quick double-taps fine, scripted
  // spam capped.
  const limited = await checkAndIncrement(
    `chatreact:${room.id}:${session}`,
    60,
    60_000,
  );
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Slow down — too many reactions." },
      { status: 429 },
    );
  }

  // Room-bound message existence check. Cheap, single index hit.
  const [msgOk] = await db.execute<{ ok: boolean }>(sql`
    SELECT EXISTS(
      SELECT 1 FROM ${chatMessages}
      WHERE id = ${id}::uuid AND room_id = ${room.id}
    ) AS ok
  `);
  if (!msgOk?.ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Race-safe toggle: try to INSERT with ON CONFLICT DO NOTHING
  // first. If the row landed, this tap ADDED the reaction. If the
  // row was already there, ON CONFLICT silently no-ops and we fall
  // through to DELETE — which removes it. Two parallel requests
  // from the same (session, emoji) race cleanly: one INSERT wins,
  // the other no-ops to "already there" and DELETEs — net result
  // matches a single tap.
  const inserted = await db
    .insert(chatReactions)
    .values({ messageId: id, sessionId: session, name, emoji })
    .onConflictDoNothing({
      target: [
        chatReactions.messageId,
        chatReactions.sessionId,
        chatReactions.emoji,
      ],
    })
    .returning({ id: chatReactions.messageId });

  let added: boolean;
  if (inserted.length > 0) {
    added = true;
  } else {
    await db
      .delete(chatReactions)
      .where(
        and(
          eq(chatReactions.messageId, id),
          eq(chatReactions.sessionId, session),
          eq(chatReactions.emoji, emoji),
        ),
      );
    added = false;
  }

  // Delta payload: emoji + added + sessionId + name. Listeners patch
  // the affected message's reactions map locally instead of firing a
  // full 50-row GET — at climax 30 viewers reacting was previously
  // ~3000 GETs/min, now ~zero. A throttled refetch still runs as a
  // safety net for clients that missed the broadcast (see chat-panel).
  await broadcastToRoom(code, {
    type: "chat:react",
    id,
    emoji,
    added,
    sessionId: session,
    name,
  });
  return NextResponse.json({ ok: true, added });
}

export const dynamic = "force-dynamic";
