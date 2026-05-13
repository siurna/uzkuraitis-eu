import { NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { officialFacts, rooms } from "@/lib/db/schema";
import { isAdminAuthed } from "@/lib/admin/session";
import { broadcastToRoom } from "@/lib/liveblocks-server";

// Generic key-value store for the side-bet ground truth (jury winner,
// televote winner, nul-points country, etc.). One row per key. Anyone can
// GET (the leaderboard reads it); only admins can PUT.

export async function GET() {
  const rows = await db.select().from(officialFacts);
  return NextResponse.json({
    facts: Object.fromEntries(rows.map((r) => [r.key, r.value])),
  });
}

const PutSchema = z.object({
  facts: z.record(z.string(), z.string().nullable()),
});

export async function PUT(request: Request) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  const parsed = PutSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  // Upsert non-null entries, delete null ones. (neon-http has no
  // transactions; sequential is fine here.)
  for (const [key, value] of Object.entries(parsed.data.facts)) {
    if (value === null || value === "") {
      await db.delete(officialFacts).where(sql`${officialFacts.key} = ${key}`);
    } else {
      await db
        .insert(officialFacts)
        .values({ key, value })
        .onConflictDoUpdate({
          target: officialFacts.key,
          set: { value, updatedAt: sql`now()` },
        });
    }
  }

  // Push leaderboard refresh to every room.
  const allRooms = await db.select({ code: rooms.code }).from(rooms);
  await Promise.all(
    allRooms.map((r) =>
      broadcastToRoom(r.code, { type: "leaderboard:updated" }),
    ),
  );

  return NextResponse.json({ ok: true });
}
