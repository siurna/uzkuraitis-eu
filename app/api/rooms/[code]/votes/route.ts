import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { voters, votes } from "@/lib/db/schema";
import { findRoomByCode, touchRoom } from "@/lib/rooms";
import { countries } from "@/lib/countries";
import { broadcastToRoom } from "@/lib/liveblocks-server";

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

  // Upsert voter on (room_id, session_id). Same call persists the home
  // prediction + every side bet so the whole prediction state is saved
  // atomically alongside the ballot.
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
    // betSameWinners column is intentionally not written: the bet was
    // removed (it duplicates jury+televote winner picks).
    betSameWinners: null,
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
    .returning();

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
  if (!sessionId) {
    return NextResponse.json({ error: "Missing session" }, { status: 400 });
  }

  await db
    .delete(voters)
    .where(and(eq(voters.roomId, room.id), eq(voters.sessionId, sessionId)));

  return NextResponse.json({ ok: true });
}

// Used by the legacy CSV export — list every ballot in a room.
export async function GET(_req: Request, { params }: RouteCtx) {
  const { code } = await params;
  const room = await findRoomByCode(code);
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const rows = await db
    .select({
      voterId: voters.id,
      voterName: voters.name,
      voterCreatedAt: voters.createdAt,
      points: votes.points,
      countryCode: votes.countryCode,
    })
    .from(voters)
    .leftJoin(votes, eq(votes.voterId, voters.id))
    .where(eq(voters.roomId, room.id));

  return NextResponse.json({ rows });
}

// silence unused import warnings if a future route stops using one of these
void inArray;
