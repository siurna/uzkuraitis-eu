import { NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { reactions } from "@/lib/db/schema";
import { findRoomByCode } from "@/lib/rooms";
import { guardAnySession, readSignedSessionId } from "@/lib/server-session";
import { checkAndIncrement } from "@/lib/rate-limit";

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

  const guard = await guardAnySession();
  if (guard) return guard;

  // Reactions are high-volume during a song's climax, so the bucket is
  // forgiving (60 per minute) — but bounded enough to stop a script
  // from inflating fake reaction counts on a single country.
  const session = await readSignedSessionId();
  if (session) {
    const rl = await checkAndIncrement(
      `reactions:${room.id}:${session}`,
      60,
      60_000,
    );
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Slow down on the reactions." },
        { status: 429 },
      );
    }
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
  // Project the three columns the renderer actually consumes —
  // dropping `updatedAt` saves bytes both on the wire and in the
  // edge cache. Same SWR pattern as /scores: live updates land via
  // the broadcast bus, the cache header just protects cold starts.
  const rows = await db
    .select({
      countryCode: reactions.countryCode,
      emoji: reactions.emoji,
      count: reactions.count,
    })
    .from(reactions)
    .where(sql`${reactions.roomId} = ${room.id}`);
  const res = NextResponse.json({ reactions: rows });
  res.headers.set(
    "Cache-Control",
    "public, s-maxage=2, stale-while-revalidate=10",
  );
  return res;
}
