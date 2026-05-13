import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { chatMessages, chatReactions } from "@/lib/db/schema";
import { findRoomByCode } from "@/lib/rooms";
import { broadcastToRoom } from "@/lib/liveblocks-server";
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
  if (limited) {
    return NextResponse.json(
      { error: "Slow down — too many reactions." },
      { status: 429 },
    );
  }

  // Make sure the message exists and is in this room.
  const [msg] = await db
    .select({ id: chatMessages.id })
    .from(chatMessages)
    .where(and(eq(chatMessages.id, id), eq(chatMessages.roomId, room.id)))
    .limit(1);
  if (!msg) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const existing = await db
    .select()
    .from(chatReactions)
    .where(
      and(
        eq(chatReactions.messageId, id),
        eq(chatReactions.sessionId, session),
        eq(chatReactions.emoji, emoji),
      ),
    )
    .limit(1);

  let added: boolean;
  if (existing.length > 0) {
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
  } else {
    await db.insert(chatReactions).values({
      messageId: id,
      sessionId: session,
      name,
      emoji,
    });
    added = true;
  }

  await broadcastToRoom(code, { type: "chat:react", id });
  return NextResponse.json({ ok: true, added });
}

export const dynamic = "force-dynamic";
