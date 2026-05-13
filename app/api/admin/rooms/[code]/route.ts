import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { rooms, voters, votes } from "@/lib/db/schema";
import { findRoomByCode, changeRoomCode, invalidateRoomCache } from "@/lib/rooms";
import { isAdminAuthed } from "@/lib/admin/session";
import { broadcastToRoom } from "@/lib/liveblocks-server";

type RouteCtx = { params: Promise<{ code: string }> };

const PatchSchema = z.object({
  votingEnabled: z.boolean().optional(),
  /** When true, the room's leaderboard becomes visible. */
  tallyEnabled: z.boolean().optional(),
  name: z.string().trim().min(1).max(60).optional(),
  commentatorEnabled: z.boolean().optional(),
  code: z.string().length(6).optional(),
  /** NULL or 0 = unlimited answers per question. */
  triviaMaxAnswerers: z.number().int().min(0).max(1000).nullable().optional(),
});

async function requireAdmin() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }
  return null;
}

export async function PATCH(request: Request, { params }: RouteCtx) {
  const guard = await requireAdmin();
  if (guard) return guard;

  const { code } = await params;
  const room = await findRoomByCode(code);
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const parsed = PatchSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { code: nextCode, ...rest } = parsed.data;
  if (Object.keys(rest).length > 0) {
    await db.update(rooms).set(rest).where(eq(rooms.id, room.id));
    // Bust the in-process room cache so the next findRoomByCode in
    // this lambda warm-instance reads the new values.
    invalidateRoomCache(room.code);
  }
  let newCode = room.code;
  if (nextCode && nextCode.toUpperCase() !== room.code) {
    const updated = await changeRoomCode(room.id, nextCode);
    if (!updated) {
      return NextResponse.json({ error: "That code is taken or invalid." }, { status: 409 });
    }
    invalidateRoomCache(room.code);
    invalidateRoomCache(updated.code);
    newCode = updated.code;
  }
  // Push room props change to every connected client so e.g. the standings
  // page hides the vote CTA the moment voting toggles closed.
  await broadcastToRoom(newCode, { type: "room:updated" });
  // Revealing results: nudge the leaderboard subscribers to refetch.
  if (parsed.data.tallyEnabled === true && room.tallyEnabled !== true) {
    await broadcastToRoom(newCode, { type: "leaderboard:updated" });
  }
  return NextResponse.json({ ok: true, code: newCode });
}

// Wipe all votes (and voters) inside a room. The room itself stays, so the
// shared link keeps working — the host can hit "reset" between songs.
export async function DELETE(_req: Request, { params }: RouteCtx) {
  const guard = await requireAdmin();
  if (guard) return guard;

  const { code } = await params;
  const room = await findRoomByCode(code);
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  // Cascade: delete the voters → ON DELETE CASCADE drops their votes too.
  await db.delete(voters).where(eq(voters.roomId, room.id));
  // Belt-and-suspenders for any orphaned votes (shouldn't be any, but cheap).
  void votes;
  return NextResponse.json({ ok: true });
}
