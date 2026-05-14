import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { triviaAnswers } from "@/lib/db/schema";
import { findRoomByCode, touchRoom } from "@/lib/rooms";
import { TRIVIA_POINTS } from "@/lib/trivia";
import { getTriviaMerged } from "@/lib/trivia-store";
import { guardSession } from "@/lib/server-session";

// POST /api/rooms/<code>/trivia
//
// Body: { sessionId, countryCode, choiceIndex (0..3) }
// Server looks up the question in the static deck, decides correctness,
// stores the answer once (idempotent — the table's PK locks one answer
// per session+country), and returns the correct index so the client can
// render the reveal. The +2 itself lands at leaderboard-compute time.

const Body = z.object({
  sessionId: z.string().min(1).max(64),
  countryCode: z.string().toLowerCase().regex(/^[a-z]{2}$/),
  choiceIndex: z.number().int().min(0).max(3),
});

type RouteCtx = { params: Promise<{ code: string }> };

export async function POST(req: Request, { params }: RouteCtx) {
  const { code } = await params;
  const room = await findRoomByCode(code);
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { sessionId, countryCode, choiceIndex } = parsed.data;

  const guard = await guardSession(sessionId);
  if (guard) return guard;
  const card = await getTriviaMerged(countryCode);
  if (!card) {
    return NextResponse.json({ error: "No trivia for that country" }, { status: 404 });
  }
  const correct = choiceIndex === card.correctIndex;

  // Per-room threshold: if the host capped the question at N answerers
  // and N players already locked an answer for this country, this one
  // comes too late. We check BEFORE the insert so a denied answer
  // doesn't burn the player's idempotency slot.
  //
  // PERF: the count + "did this session already answer" lookups used
  // to run sequentially; they share nothing so they fan out in
  // parallel now. Hot path during a country's reveal window.
  if (room.triviaMaxAnswerers != null && room.triviaMaxAnswerers > 0) {
    const [countRow, existingRow] = await Promise.all([
      db
        .select({ n: sql<number>`COUNT(*)::int` })
        .from(triviaAnswers)
        .where(
          and(
            eq(triviaAnswers.roomId, room.id),
            eq(triviaAnswers.countryCode, countryCode),
          ),
        )
        .then((rows) => rows[0]),
      db
        .select({ sessionId: triviaAnswers.sessionId })
        .from(triviaAnswers)
        .where(
          and(
            eq(triviaAnswers.roomId, room.id),
            eq(triviaAnswers.countryCode, countryCode),
            eq(triviaAnswers.sessionId, sessionId),
          ),
        )
        .limit(1)
        .then((rows) => rows[0]),
    ]);
    if (!existingRow && (countRow?.n ?? 0) >= room.triviaMaxAnswerers) {
      return NextResponse.json(
        {
          ok: false,
          tooLate: true,
          correctIndex: card.correctIndex,
        },
        { status: 409 },
      );
    }
  }

  // Idempotent insert — the unique primary key means a second answer
  // attempt is ignored without throwing. We always return the real
  // correctIndex so the client can render the reveal either way.
  await db
    .insert(triviaAnswers)
    .values({
      roomId: room.id,
      sessionId,
      countryCode,
      choiceIndex,
      correct,
    })
    .onConflictDoNothing();

  // Keep the room "active" for leaderboard sweeps + listing.
  await touchRoom(room.id);

  return NextResponse.json({
    ok: true,
    correct,
    correctIndex: card.correctIndex,
    points: correct ? TRIVIA_POINTS : 0,
  });
}

export const dynamic = "force-dynamic";
