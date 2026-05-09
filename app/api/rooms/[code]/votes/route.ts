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
  // Optional, but required for full scoring once results are entered.
  homePrediction: z.number().int().min(1).max(50).nullable().optional(),
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

  const { name, sessionId, votes: ballot, homePrediction } = parsed.data;

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

  // Upsert voter on (room_id, session_id). Same call also persists the
  // home-country prediction so it's saved alongside the ballot.
  const [voter] = await db
    .insert(voters)
    .values({
      roomId: room.id,
      sessionId,
      name,
      homeCountryPrediction: homePrediction ?? null,
    })
    .onConflictDoUpdate({
      target: [voters.roomId, voters.sessionId],
      set: {
        name,
        homeCountryPrediction: homePrediction ?? null,
        updatedAt: sql`now()`,
      },
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
