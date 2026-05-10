import { NextResponse } from "next/server";
import { customAlphabet } from "nanoid";
import { eq, and, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { rooms } from "@/lib/db/schema";
import { findRoomByCode } from "@/lib/rooms";
import { isAdminAuthed } from "@/lib/admin/session";
import { broadcastToRoom } from "@/lib/liveblocks-server";

const ROOM_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const generateCode = customAlphabet(ROOM_CODE_ALPHABET, 6);

type RouteCtx = { params: Promise<{ code: string }> };

// Roll the room's join code. Old code stops working immediately;
// anyone with the old URL gets "room not found". The per-room admin
// token (separate field) is preserved.
export async function POST(_req: Request, { params }: RouteCtx) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }
  const { code } = await params;
  const room = await findRoomByCode(code);
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  // Generate a code that doesn't collide with any other room.
  for (let attempt = 0; attempt < 8; attempt++) {
    const next = generateCode();
    const [conflict] = await db
      .select({ id: rooms.id })
      .from(rooms)
      .where(and(eq(rooms.code, next), ne(rooms.id, room.id)))
      .limit(1);
    if (conflict) continue;

    await db.update(rooms).set({ code: next }).where(eq(rooms.id, room.id));
    // Tell the new room id to refresh just in case anyone has it open.
    await broadcastToRoom(next, { type: "leaderboard:updated" });
    return NextResponse.json({ ok: true, code: next });
  }
  return NextResponse.json(
    { error: "Couldn't allocate a free code." },
    { status: 500 },
  );
}
