import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  voters,
  chatMessages,
  triviaAnswers,
  pushSubscriptions,
} from "@/lib/db/schema";
import { findRoomByCode } from "@/lib/rooms";
import { isAdminAuthed } from "@/lib/admin/session";
import { broadcastToRoom } from "@/lib/realtime-server";

// Remove a single participant from a room: delete their voter row
// (cascades to votes), their chat messages, their trivia answers and
// their push subscriptions for this room, then broadcast chat:delete
// per message so every connected client drops the rows. The same
// person can rejoin if they want — this is a reset button, not a
// permanent ban.

type RouteCtx = { params: Promise<{ code: string; sessionId: string }> };

export async function DELETE(_req: Request, { params }: RouteCtx) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }
  const { code, sessionId } = await params;
  const room = await findRoomByCode(code);
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  // Pull message ids first so we can broadcast chat:delete after the
  // rows are gone — otherwise viewers keep seeing the messages until
  // they reload.
  const msgRows = await db
    .select({ id: chatMessages.id })
    .from(chatMessages)
    .where(
      and(
        eq(chatMessages.roomId, room.id),
        eq(chatMessages.sessionId, sessionId),
      ),
    );

  await db.transaction(async (tx) => {
    await tx
      .delete(chatMessages)
      .where(
        and(
          eq(chatMessages.roomId, room.id),
          eq(chatMessages.sessionId, sessionId),
        ),
      );
    await tx
      .delete(voters)
      .where(
        and(eq(voters.roomId, room.id), eq(voters.sessionId, sessionId)),
      );
    await tx
      .delete(triviaAnswers)
      .where(
        and(
          eq(triviaAnswers.roomId, room.id),
          eq(triviaAnswers.sessionId, sessionId),
        ),
      );
    await tx
      .delete(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.roomId, room.id),
          eq(pushSubscriptions.sessionId, sessionId),
        ),
      );
  });

  await Promise.all(
    msgRows.map((m) =>
      broadcastToRoom(room.code, { type: "chat:delete", id: m.id }),
    ),
  );

  return NextResponse.json({ ok: true, removed: msgRows.length });
}

export const dynamic = "force-dynamic";
