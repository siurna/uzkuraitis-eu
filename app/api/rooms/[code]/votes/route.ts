import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { voters, votes } from "@/lib/db/schema";
import { findRoomByCode, touchRoom } from "@/lib/rooms";
import { countries } from "@/lib/countries";
import { broadcastToRoom } from "@/lib/realtime-server";
import { postSystemMessage } from "@/lib/chat-system";
import { guardSession } from "@/lib/server-session";
import { checkAndIncrement } from "@/lib/rate-limit";

const POINT_KEYS = ["12", "10", "8", "7", "6", "5", "4", "3", "2", "1"] as const;

const VotesSchema = z.object({
  name: z.string().trim().min(1).max(40),
  sessionId: z.string().min(8).max(64),
  votes: z
    .object(
      Object.fromEntries(
        POINT_KEYS.map((k) => [k, z.string().min(1)]),
      ) as Record<(typeof POINT_KEYS)[number], z.ZodString>,
    )
    .strict(),
  // Home-country placement prediction (e.g. "Lithuania finishes 7th").
  homePrediction: z.number().int().min(1).max(50).nullable().optional(),
  // Side bets, all optional, all nullable.
  bets: z
    .object({
      woodenSpoon: z.string().min(2).max(4).nullable().optional(),
      lt12To: z.string().min(2).max(4).nullable().optional(),
      highestBig5: z.string().min(2).max(4).nullable().optional(),
      juryWinner: z.string().min(2).max(4).nullable().optional(),
      televoteWinner: z.string().min(2).max(4).nullable().optional(),
      // Multi-select: 0..N country codes (or NONE_TOKEN). Capped at 5
      // (matches NUL_TELEVOTE_MAX_PICKS in lib/scoring.ts) so a voter
      // can't carpet-bomb every country to guarantee a top score.
      nulTelevote: z.array(z.string().min(2).max(4)).max(5).nullable().optional(),
      hostTop3: z.boolean().nullable().optional(),
      winnerSolo: z.boolean().nullable().optional(),
      ltTotalPoints: z.number().int().min(0).max(1000).nullable().optional(),
    })
    .optional()
    .default({}),
});

type RouteCtx = { params: Promise<{ code: string }> };

export async function POST(request: Request, { params }: RouteCtx) {
  const { code } = await params;
  const room = await findRoomByCode(code);
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }
  if (!room.votingEnabled) {
    return NextResponse.json(
      { error: "Voting is closed for this room." },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = VotesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }

  const {
    name,
    sessionId,
    votes: ballot,
    homePrediction,
    bets,
  } = parsed.data;

  const guard = await guardSession(sessionId);
  if (guard) return guard;

  // 30 ballot writes per minute per session is plenty for legitimate
  // re-edits and stops a stolen session from carpet-bombing the table.
  const limited = await checkAndIncrement(
    `votes:${room.id}:${sessionId}`,
    30,
    60_000,
  );
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Slow down — too many ballot updates." },
      { status: 429 },
    );
  }

  // Cross-check countries actually exist + no dupes.
  const validCodes = new Set(countries.map((c) => c.code));
  const used = new Set<string>();
  for (const code of Object.values(ballot)) {
    if (!validCodes.has(code)) {
      return NextResponse.json(
        { error: `Unknown country code: ${code}` },
        { status: 400 },
      );
    }
    if (used.has(code)) {
      return NextResponse.json(
        { error: `Country ${code} cannot receive two different point values.` },
        { status: 400 },
      );
    }
    used.add(code);
  }

  // Upsert voter on (room_id, session_id) AND derive "first cast" from
  // the same RETURNING — Postgres's `xmax` system column is 0 for a
  // fresh insert, non-zero for the UPDATE branch of an UPSERT. So
  // we collapse the previous SELECT-then-upsert pair into a single
  // round-trip that yields the row + the isFirstCast flag.
  const voterValues = {
    roomId: room.id,
    sessionId,
    name,
    homeCountryPrediction: homePrediction ?? null,
    betWoodenSpoon: bets.woodenSpoon ?? null,
    betLt12To: bets.lt12To ?? null,
    betHighestBig5: bets.highestBig5 ?? null,
    betJuryWinner: bets.juryWinner ?? null,
    betTelevoteWinner: bets.televoteWinner ?? null,
    betNulTelevote: bets.nulTelevote ?? null,
    betHostTop3: bets.hostTop3 ?? null,
    betWinnerSolo: bets.winnerSolo ?? null,
    betLtTotalPoints: bets.ltTotalPoints ?? null,
  } as const;
  const [voter] = await db
    .insert(voters)
    .values(voterValues)
    .onConflictDoUpdate({
      target: [voters.roomId, voters.sessionId],
      set: { ...voterValues, updatedAt: sql`now()` },
    })
    .returning({
      id: voters.id,
      isFirstCast: sql<boolean>`(xmax = 0)`,
    });
  const isFirstCast = voter.isFirstCast;

  // Replace ballot atomically.
  await db.delete(votes).where(eq(votes.voterId, voter.id));
  await db.insert(votes).values(
    POINT_KEYS.map((k) => ({
      voterId: voter.id,
      points: Number(k),
      countryCode: ballot[k],
    })),
  );

  await touchRoom(room.id);

  // Push a realtime hint so every connected client refetches their
  // scoreboard immediately. No polling needed.
  await broadcastToRoom(room.code, { type: "scores:updated" });

  // Meta-narrate the *first* cast in chat (not every re-save). Awaited
  // (it swallows its own errors) so the row + chat:new broadcast
  // complete before the lambda is frozen.
  if (isFirstCast) {
    await postSystemMessage(room.code, room.id, { key: "sys_voted", arg: name });
  }

  return NextResponse.json({ ok: true, voterId: voter.id });
}

export async function DELETE(request: Request, { params }: RouteCtx) {
  const { code } = await params;
  const room = await findRoomByCode(code);
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session");
  if (sessionId) {
    const guard = await guardSession(sessionId);
    if (guard) return guard;
  }
  if (!sessionId) {
    return NextResponse.json({ error: "Missing session" }, { status: 400 });
  }

  await db
    .delete(voters)
    .where(and(eq(voters.roomId, room.id), eq(voters.sessionId, sessionId)));

  return NextResponse.json({ ok: true });
}

export const dynamic = "force-dynamic";
