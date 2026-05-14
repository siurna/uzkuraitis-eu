import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { roomFacts, officialFacts } from "@/lib/db/schema";
import { findRoomByCodeWithToken } from "@/lib/rooms";
import { broadcastToRoom } from "@/lib/liveblocks-server";

type RouteCtx = { params: Promise<{ code: string }> };

const PutSchema = z.object({
  facts: z.record(z.string(), z.string().nullable()),
});

async function requireAdmin(req: Request, code: string) {
  const token = req.headers.get("x-admin-token") ?? "";
  return findRoomByCodeWithToken(code, token);
}

export async function GET(req: Request, { params }: RouteCtx) {
  const { code } = await params;
  const room = await requireAdmin(req, code);
  if (!room) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }
  const rows = await db
    .select()
    .from(roomFacts)
    .where(eq(roomFacts.roomId, room.id));
  return NextResponse.json({
    facts: Object.fromEntries(rows.map((r) => [r.key, r.value])),
  });
}

// Upsert non-null entries, delete null ones. Same shape as the global
// /api/admin/official-facts but scoped to this room.
export async function PUT(req: Request, { params }: RouteCtx) {
  const { code } = await params;
  const room = await requireAdmin(req, code);
  if (!room) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }
  const parsed = PutSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  // Sequential upserts/deletes are fine for an admin save: a partial
  // write just means re-save.
  for (const [key, value] of Object.entries(parsed.data.facts)) {
    if (value === null || value === "") {
      await db
        .delete(roomFacts)
        .where(sql`${roomFacts.roomId} = ${room.id} AND ${roomFacts.key} = ${key}`);
    } else {
      await db
        .insert(roomFacts)
        .values({ roomId: room.id, key, value })
        .onConflictDoUpdate({
          target: [roomFacts.roomId, roomFacts.key],
          set: { value, updatedAt: sql`now()` },
        });
    }
  }

  await broadcastToRoom(room.code, { type: "leaderboard:updated" });
  return NextResponse.json({ ok: true });
}

// Pull every key from official_facts into this room's room_facts table.
export async function POST(req: Request, { params }: RouteCtx) {
  const { code } = await params;
  const room = await requireAdmin(req, code);
  if (!room) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }
  const global = await db.select().from(officialFacts);
  await db.delete(roomFacts).where(eq(roomFacts.roomId, room.id));
  if (global.length > 0) {
    await db
      .insert(roomFacts)
      .values(global.map((g) => ({ roomId: room.id, key: g.key, value: g.value })));
  }
  await broadcastToRoom(room.code, { type: "leaderboard:updated" });
  return NextResponse.json({ ok: true, copied: global.length });
}

export async function DELETE(req: Request, { params }: RouteCtx) {
  const { code } = await params;
  const room = await requireAdmin(req, code);
  if (!room) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }
  await db.delete(roomFacts).where(eq(roomFacts.roomId, room.id));
  await broadcastToRoom(room.code, { type: "leaderboard:updated" });
  return NextResponse.json({ ok: true });
}
