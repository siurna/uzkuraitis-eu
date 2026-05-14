import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { roomResults, officialResults } from "@/lib/db/schema";
import { findRoomByCodeWithToken } from "@/lib/rooms";
import { countries } from "@/lib/countries";
import { broadcastToRoom } from "@/lib/liveblocks-server";

type RouteCtx = { params: Promise<{ code: string }> };

const PutSchema = z.object({
  results: z
    .array(
      z.object({
        countryCode: z.string().length(2),
        placement: z.number().int().min(1).max(50),
      }),
    )
    .max(50),
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
    .from(roomResults)
    .where(eq(roomResults.roomId, room.id));
  rows.sort((a, b) => a.placement - b.placement);
  return NextResponse.json({ results: rows });
}

// Replace this room's per-room results wholesale. Empty array = wipe
// (room falls back to the global official_results for scoring).
export async function PUT(req: Request, { params }: RouteCtx) {
  const { code } = await params;
  const room = await requireAdmin(req, code);
  if (!room) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }
  const parsed = PutSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid body" },
      { status: 400 },
    );
  }

  const validCodes = new Set(countries.map((c) => c.code));
  const placements = parsed.data.results.map((r) => r.placement);
  if (new Set(placements).size !== placements.length) {
    return NextResponse.json(
      { error: "Duplicate placements." },
      { status: 400 },
    );
  }
  for (const r of parsed.data.results) {
    if (!validCodes.has(r.countryCode)) {
      return NextResponse.json(
        { error: `Unknown country: ${r.countryCode}` },
        { status: 400 },
      );
    }
  }

  // Delete-then-insert is fine for an admin save: a momentary
  // "no results" window at worst.
  await db.delete(roomResults).where(eq(roomResults.roomId, room.id));
  if (parsed.data.results.length > 0) {
    await db.insert(roomResults).values(
      parsed.data.results.map((r) => ({
        roomId: room.id,
        countryCode: r.countryCode,
        placement: r.placement,
      })),
    );
  }

  await broadcastToRoom(room.code, { type: "leaderboard:updated" });
  return NextResponse.json({ ok: true });
}

// Copy the global official_results into this room's room_results table.
// Lets the host reuse the live show's result without re-typing it.
export async function POST(req: Request, { params }: RouteCtx) {
  const { code } = await params;
  const room = await requireAdmin(req, code);
  if (!room) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }
  const global = await db.select().from(officialResults);
  await db.delete(roomResults).where(eq(roomResults.roomId, room.id));
  if (global.length > 0) {
    await db.insert(roomResults).values(
      global.map((g) => ({
        roomId: room.id,
        countryCode: g.countryCode,
        placement: g.placement,
      })),
    );
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
  await db.delete(roomResults).where(eq(roomResults.roomId, room.id));
  await broadcastToRoom(room.code, { type: "leaderboard:updated" });
  return NextResponse.json({ ok: true });
}
