import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { chatMessages } from "@/lib/db/schema";
import { findRoomByCode } from "@/lib/rooms";
import { isAdminAuthed } from "@/lib/admin/session";
import { broadcastToRoom } from "@/lib/realtime-server";

// Admin-side delete for moderation. Mirrors the author-scoped DELETE on
// /api/rooms/[code]/chat/[id] but uses the admin passkey session
// instead of an authoring-session match, so a moderator can pull any
// message regardless of who wrote it.

type RouteCtx = { params: Promise<{ code: string; id: string }> };

export async function DELETE(_req: Request, { params }: RouteCtx) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }
  const { code, id } = await params;
  const room = await findRoomByCode(code);
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  const deleted = await db
    .delete(chatMessages)
    .where(and(eq(chatMessages.id, id), eq(chatMessages.roomId, room.id)))
    .returning({ id: chatMessages.id });
  if (deleted.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await broadcastToRoom(code, { type: "chat:delete", id });
  return NextResponse.json({ ok: true });
}

export const dynamic = "force-dynamic";
