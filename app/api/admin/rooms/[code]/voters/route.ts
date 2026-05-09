import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { voters } from "@/lib/db/schema";
import { findRoomByCode } from "@/lib/rooms";
import { isAdminAuthed } from "@/lib/admin/session";

type RouteCtx = { params: Promise<{ code: string }> };

// Wipe every voter (and via cascade, every vote) in this room.
// The room itself, its code, and any reactions stay.
export async function DELETE(_req: Request, { params }: RouteCtx) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }
  const { code } = await params;
  const room = await findRoomByCode(code);
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }
  await db.delete(voters).where(eq(voters.roomId, room.id));
  return NextResponse.json({ ok: true });
}
