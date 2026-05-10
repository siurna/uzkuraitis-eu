import { NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { reactions } from "@/lib/db/schema";
import { findRoomByCode } from "@/lib/rooms";

const ReactionSchema = z.object({
  countryCode: z.string().length(2),
  emoji: z.string().min(1).max(8),
  delta: z.number().int().min(1).max(20).default(1),
});

type RouteCtx = { params: Promise<{ code: string }> };

// Persist reaction tallies. Live floats are broadcast over Liveblocks; this
// route is the durable counter so "Lithuania got 47 hearts" survives reload.
export async function POST(request: Request, { params }: RouteCtx) {
  const { code } = await params;
  const room = await findRoomByCode(code);
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = ReactionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid reaction payload" },
      { status: 400 },
    );
  }

  const { countryCode, emoji, delta } = parsed.data;

  await db
    .insert(reactions)
    .values({ roomId: room.id, countryCode, emoji, count: delta })
    .onConflictDoUpdate({
      target: [reactions.roomId, reactions.countryCode, reactions.emoji],
      set: {
        count: sql`${reactions.count} + ${delta}`,
        updatedAt: sql`now()`,
      },
    });

  return NextResponse.json({ ok: true });
}

export async function GET(_req: Request, { params }: RouteCtx) {
  const { code } = await params;
  const room = await findRoomByCode(code);
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }
  const rows = await db
    .select()
    .from(reactions)
    .where(sql`${reactions.roomId} = ${room.id}`);
  return NextResponse.json({ reactions: rows });
}
