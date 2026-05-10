import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { chatMessages } from "@/lib/db/schema";
import { findRoomByCode } from "@/lib/rooms";
import { broadcastToRoom } from "@/lib/liveblocks-server";

// Soft delete: a voter can only delete their own messages (matched by
// session). The row is removed outright; deleting it cascades the
// reactions.

type RouteCtx = { params: Promise<{ code: string; id: string }> };

export async function DELETE(req: Request, { params }: RouteCtx) {
  const { code, id } = await params;
  const room = await findRoomByCode(code);
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  const url = new URL(req.url);
  const session = url.searchParams.get("session");
  if (!session) return NextResponse.json({ error: "Missing session" }, { status: 400 });

  const deleted = await db
    .delete(chatMessages)
    .where(
      and(
        eq(chatMessages.id, id),
        eq(chatMessages.roomId, room.id),
        eq(chatMessages.sessionId, session),
      ),
    )
    .returning({ id: chatMessages.id });

  if (deleted.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await broadcastToRoom(code, { type: "chat:delete", id });
  return NextResponse.json({ ok: true });
}
