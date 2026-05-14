import { NextResponse } from "next/server";
import { z } from "zod";
import { asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { officialResults } from "@/lib/db/schema";
import { isAdminAuthed } from "@/lib/admin/session";
import { broadcastToRoom } from "@/lib/realtime-server";
import { rooms } from "@/lib/db/schema";
import { countries } from "@/lib/countries";

// Read the current official result. Anyone can see it (it's the public
// scoreboard data), no auth needed. Sort happens in SQL so the client
// can render straight from the array.
export async function GET() {
  const rows = await db
    .select()
    .from(officialResults)
    .orderBy(asc(officialResults.placement));
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

  // Filter out placements pointing at countries no longer in the
  // running order — happens when a non-finalist (Luxembourg etc) was
  // dropped from `lib/countries.ts` mid-session but their saved row
  // is still in the admin UI's draft. Silently drop them here so the
  // admin can still save the rest; the missing rows reappear empty
  // on next render.
  const validCodes = new Set(countries.map((c) => c.code));
  const cleaned = parsed.data.results.filter((row) =>
    validCodes.has(row.countryCode),
  );

  // Reject duplicate placements (two countries can't share a position).
  const placements = cleaned.map((r) => r.placement);
  if (new Set(placements).size !== placements.length) {
    return NextResponse.json(
      { error: "Duplicate placements detected." },
      { status: 400 },
    );
  }

  // Wipe and reinsert. The brief "no results" window between the two
  // statements is acceptable for an admin save.
  await db.delete(officialResults);
  if (cleaned.length > 0) {
    await db.insert(officialResults).values(cleaned);
  }

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
