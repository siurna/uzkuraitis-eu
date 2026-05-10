import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { officialResults } from "@/lib/db/schema";
import { isAdminAuthed } from "@/lib/admin/session";
import { broadcastToRoom } from "@/lib/liveblocks-server";
import { rooms } from "@/lib/db/schema";
import { countries } from "@/lib/countries";

// Read the current official result. Anyone can see it (it's the public
// scoreboard data), no auth needed.
export async function GET() {
  const rows = await db.select().from(officialResults);
  rows.sort((a, b) => a.placement - b.placement);
  return NextResponse.json({ results: rows });
}

const ResultSchema = z.object({
  results: z
    .array(
      z.object({
        countryCode: z.string().length(2),
        placement: z.number().int().min(1).max(50),
      }),
    )
    .max(50),
});

// Replace the official result wholesale. Admin-only. Triggers a leaderboard
// refresh broadcast in every room so connected clients refetch.
export async function PUT(request: Request) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  const parsed = ResultSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid body" },
      { status: 400 },
    );
  }

  // Reject placements pointing at unknown countries.
  const validCodes = new Set(countries.map((c) => c.code));
  for (const row of parsed.data.results) {
    if (!validCodes.has(row.countryCode)) {
      return NextResponse.json(
        { error: `Unknown country code: ${row.countryCode}` },
        { status: 400 },
      );
    }
  }

  // Reject duplicate placements (two countries can't share a position).
  const placements = parsed.data.results.map((r) => r.placement);
  if (new Set(placements).size !== placements.length) {
    return NextResponse.json(
      { error: "Duplicate placements detected." },
      { status: 400 },
    );
  }

  // Wipe and reinsert in a single transaction so the scoreboard never sees
  // a half-written state.
  await db.transaction(async (tx) => {
    await tx.delete(officialResults);
    if (parsed.data.results.length > 0) {
      await tx.insert(officialResults).values(parsed.data.results);
    }
  });

  // Tell every room to refresh its leaderboard. Cheap blast.
  const allRooms = await db.select({ code: rooms.code }).from(rooms);
  await Promise.all(
    allRooms.map((r) =>
      broadcastToRoom(r.code, { type: "leaderboard:updated" }),
    ),
  );

  return NextResponse.json({ ok: true });
}

// Clear the official results entirely (back to "waiting").
export async function DELETE() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }
  await db.delete(officialResults);
  const allRooms = await db.select({ code: rooms.code }).from(rooms);
  await Promise.all(
    allRooms.map((r) =>
      broadcastToRoom(r.code, { type: "leaderboard:updated" }),
    ),
  );
  return NextResponse.json({ ok: true });
}
