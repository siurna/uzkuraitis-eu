import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { rooms, voters } from "@/lib/db/schema";
import {
  findRoomByCodeWithToken,
  changeRoomCode,
} from "@/lib/rooms";
import { broadcastToRoom } from "@/lib/liveblocks-server";

// Per-room admin endpoint. All actions require an "X-Admin-Token" header
// matching the room's stored token. The token is generated at room
// creation and bundled into the share-link the host gets.
//
// PATCH    edit room props (name, voting toggle, home country, code)
// DELETE   wipe every voter (and their votes) in this room
//
// Sub-routes for results/facts/import live in this directory's siblings.

type RouteCtx = { params: Promise<{ code: string }> };

const PatchSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  votingEnabled: z.boolean().optional(),
  tallyEnabled: z.boolean().optional(),
  homeCountryCode: z.string().length(2).optional(),
  code: z.string().min(6).max(6).optional(),
});

async function requireRoomAdmin(req: Request, code: string) {
  const token = req.headers.get("x-admin-token") ?? "";
  const room = await findRoomByCodeWithToken(code, token);
  if (!room) return null;
  return room;
}

export async function GET(req: Request, { params }: RouteCtx) {
  const { code } = await params;
  const room = await requireRoomAdmin(req, code);
  if (!room) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }
  return NextResponse.json({
    room: {
      id: room.id,
      code: room.code,
      name: room.name,
      votingEnabled: room.votingEnabled,
      tallyEnabled: room.tallyEnabled,
      homeCountryCode: room.homeCountryCode,
    },
  });
}

export async function PATCH(req: Request, { params }: RouteCtx) {
  const { code } = await params;
  const room = await requireRoomAdmin(req, code);
  if (!room) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }
  const parsed = PatchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { code: nextCode, ...rest } = parsed.data;

  // Apply non-code fields first.
  if (Object.keys(rest).length > 0) {
    await db.update(rooms).set(rest).where(eq(rooms.id, room.id));
  }

  // Code change goes through changeRoomCode for collision check.
  let newCode = room.code;
  if (nextCode && nextCode !== room.code) {
    const updated = await changeRoomCode(room.id, nextCode);
    if (!updated) {
      return NextResponse.json(
        { error: "That code is taken or invalid." },
        { status: 409 },
      );
    }
    newCode = updated.code;
  }

  // Push leaderboard refresh so any open clients see config drift quickly.
  await broadcastToRoom(newCode, { type: "leaderboard:updated" });
  return NextResponse.json({ ok: true, code: newCode });
}

export async function DELETE(req: Request, { params }: RouteCtx) {
  const { code } = await params;
  const room = await requireRoomAdmin(req, code);
  if (!room) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }
  await db.delete(voters).where(eq(voters.roomId, room.id));
  await broadcastToRoom(room.code, { type: "scores:updated" });
  await broadcastToRoom(room.code, { type: "leaderboard:updated" });
  return NextResponse.json({ ok: true });
}
