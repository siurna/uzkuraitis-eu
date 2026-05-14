import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { rooms, voters, votes } from "@/lib/db/schema";
import { findRoomByCode, changeRoomCode, invalidateRoomCache } from "@/lib/rooms";
import { isAdminAuthed } from "@/lib/admin/session";
import { broadcastToRoom } from "@/lib/realtime-server";
import { deletePrefix } from "@/lib/storage";

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

// Permanently delete a room. Cascades through every child table via
// the FK ON DELETE CASCADE constraints (voters → votes, chat_messages
// → chat_reactions, reactions, room_settings, room_results,
// room_facts, trivia_answers). Storage files for the room live under
// the `chat/<room_id>/` prefix in Supabase Storage and don't cascade,
// so we wipe them explicitly before dropping the row.
export async function DELETE(_req: Request, { params }: RouteCtx) {
  const guard = await requireAdmin();
  if (guard) return guard;

  const { code } = await params;
  const room = await findRoomByCode(code);
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  // Storage first. If this throws, abort before we drop the DB row so
  // the next attempt can still find the files via the room → prefix.
  try {
    await deletePrefix("chat", `${room.id}/`);
  } catch (err) {
    return NextResponse.json(
      {
        error: `Couldn't wipe chat uploads: ${
          err instanceof Error ? err.message : String(err)
        }`,
      },
      { status: 500 },
    );
  }

  await db.delete(rooms).where(eq(rooms.id, room.id));
  // voters / votes / reactions / chat / etc. all CASCADE off rooms.id.
  // The references below keep tree-shake from dropping the imports.
  void voters;
  void votes;
  return NextResponse.json({ ok: true });
}
