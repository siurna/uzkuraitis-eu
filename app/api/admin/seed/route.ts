import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  voters,
  votes,
  chatMessages,
  chatReactions,
  officialResults,
  officialFacts,
  rooms,
} from "@/lib/db/schema";
import { isAdminAuthed } from "@/lib/admin/session";
import { findRoomByCode } from "@/lib/rooms";
import { countries } from "@/lib/countries";
import { AVATARS } from "@/lib/avatars";
import { broadcastToRoom } from "@/lib/realtime-server";

// Dev-only seeding: throw demo voters (random ballots + bets), a few
// reaction-heavy chat messages ("highlights"), or random official
// results + facts into the installation so we can eyeball the
// leaderboard / Home widgets without a real crowd / a finished show.
// Admin
// session-gated. No undo.

const DEMO_NAMES = [
  "Aušra", "Mantas", "Eglė", "Tomas", "Rūta", "Gabrielius", "Ieva", "Lukas",
  "Greta", "Domas", "Smiltė", "Karolis", "Urtė", "Jonas", "Milda", "Paulius",
  "Vakarė", "Dovydas", "Saulė", "Arūnas", "Goda", "Nojus", "Austėja", "Rokas",
  "Liepa", "Matas", "Kotryna", "Emilis", "Vilija", "Tadas",
];
const HL_LINES = [
  "this is THE song of the night, no contest",
  "i'm literally crying, who let them do this",
  "ok the staircase descent again 🪜",
  "ten points from me NOW",
  "WHAT was that key change 🤯",
  "ok this slaps actually",
  "douze points obviously",
  "i would walk to Vienna for this person",
  "the costume change??? legend",
  "Europe is NOT ready for this",
];
const HL_EMOJIS = ["❤️", "😂", "🤯", "🙌", "😱", "💀", "🔥", "👏", "🎉", "😭"];
const BIG_5 = ["gb", "de", "fr", "it", "es"];
const BALLOT_POINTS = [12, 10, 8, 7, 6, 5, 4, 3, 2, 1] as const;

function pick<T>(a: readonly T[]): T {
  return a[Math.floor(Math.random() * a.length)];
}
function shuffled<T>(a: readonly T[]): T[] {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
}
// 60% of the time return v, else null — for "this voter skipped this bet".
function maybe<T>(v: T): T | null {
  return Math.random() < 0.6 ? v : null;
}
function rid(): string {
  return Math.random().toString(36).slice(2, 9);
}

// A fresh random spread of bonus bets (+ home-country guess), most filled
// in, some skipped. Shared by the "voters" seeder and the "reroll" action.
function randomBets(codes: string[]) {
  return {
    homeCountryPrediction: maybe(1 + Math.floor(Math.random() * countries.length)),
    betWoodenSpoon: maybe(pick(codes)),
    betLt12To: maybe(pick(codes)),
    betHighestBig5: maybe(pick(BIG_5)),
    betJuryWinner: maybe(pick(codes)),
    betTelevoteWinner: maybe(pick(codes)),
    betNulTelevote: maybe(shuffled(codes).slice(0, Math.floor(Math.random() * 4))) ?? null,
    betHostTop3: maybe(Math.random() < 0.5),
    betWinnerSolo: maybe(Math.random() < 0.5),
    betLtTotalPoints: maybe(Math.floor(Math.random() * 620)),
  };
}

const Body = z.object({
  mode: z.enum(["voters", "highlights", "results", "reroll"]),
  room: z.string().length(6).optional(),
  count: z.number().int().min(1).max(60).optional(),
});

export async function POST(req: Request) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { mode } = parsed.data;
  const count = parsed.data.count ?? 8;
  const codes = countries.map((c) => c.code);

  // ── official results + facts (global; the whole installation) ──
  if (mode === "results") {
    const finalOrder = shuffled(codes); // a random final placing
    await db.delete(officialResults);
    await db.insert(officialResults).values(finalOrder.map((cc, i) => ({ countryCode: cc, placement: i + 1 })));
    const bottom = finalOrder.slice(-3);
    const facts: Record<string, string> = {
      jury_winner: finalOrder[0],
      televote_winner: finalOrder[1] ?? finalOrder[0],
      nul_televote: bottom.slice(0, 1 + Math.floor(Math.random() * 3)).join(","),
      lt_12_to: pick(codes),
      lt_total_points: String(40 + Math.floor(Math.random() * 280)),
      winner_solo: Math.random() < 0.6 ? "true" : "false",
    };
    await db.delete(officialFacts);
    await db.insert(officialFacts).values(Object.entries(facts).map(([key, value]) => ({ key, value })));
    const allRooms = await db.select({ code: rooms.code }).from(rooms);
    await Promise.all(allRooms.map((r) => broadcastToRoom(r.code, { type: "leaderboard:updated" })));
    return NextResponse.json({ ok: true, placed: finalOrder.length, facts: Object.keys(facts).length });
  }

  // ── voters / highlights need a target room ──
  const codeIn = parsed.data.room;
  if (!codeIn) return NextResponse.json({ error: "Room code required" }, { status: 400 });
  const room = await findRoomByCode(codeIn);
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  if (mode === "voters") {
    for (let i = 0; i < count; i++) {
      const ballot = shuffled(codes).slice(0, 10);
      const [voter] = await db
        .insert(voters)
        .values({
          roomId: room.id,
          sessionId: `seed-${room.id.slice(0, 8)}-${Date.now()}-${i}-${rid()}`,
          name: pick(DEMO_NAMES),
          ...randomBets(codes),
        })
        .returning({ id: voters.id });
      if (!voter) continue;
      await db
        .insert(votes)
        .values(ballot.map((cc, j) => ({ voterId: voter.id, points: BALLOT_POINTS[j], countryCode: cc })));
    }
    await broadcastToRoom(room.code, { type: "scores:updated" });
    return NextResponse.json({ ok: true, created: count });
  }

  // ── reroll: re-randomize ballots + bets for everyone already in the
  // room (no new voters). Handy after seeding to shuffle the numbers. ──
  if (mode === "reroll") {
    const existing = await db.select({ id: voters.id }).from(voters).where(eq(voters.roomId, room.id));
    for (const v of existing) {
      const ballot = shuffled(codes).slice(0, 10);
      await db.update(voters).set({ ...randomBets(codes), updatedAt: new Date() }).where(eq(voters.id, v.id));
      await db.delete(votes).where(eq(votes.voterId, v.id));
      await db
        .insert(votes)
        .values(ballot.map((cc, j) => ({ voterId: v.id, points: BALLOT_POINTS[j], countryCode: cc })));
    }
    await broadcastToRoom(room.code, { type: "scores:updated" });
    await broadcastToRoom(room.code, { type: "leaderboard:updated" });
    return NextResponse.json({ ok: true, rerolled: existing.length });
  }

  // highlights — a few chat messages, each with enough reactions (>=5)
  // to surface on Home.
  const npCode = room.nowPlayingCode ?? null;
  const inserted: string[] = [];
  for (let i = 0; i < count; i++) {
    // ~25% of highlights happen "in the interval" — no country attached.
    const npForThis = Math.random() < 0.25 ? null : npCode ?? pick(codes);
    const [msg] = await db
      .insert(chatMessages)
      .values({
        roomId: room.id,
        sessionId: `seed-hl-${Date.now()}-${i}-${rid()}`,
        name: pick(DEMO_NAMES),
        avatarId: pick(AVATARS).id,
        body: pick(HL_LINES),
        meta: npForThis ? { nowPlaying: npForThis } : {},
      })
      .returning({ id: chatMessages.id });
    if (!msg) continue;
    inserted.push(msg.id);
    // 3–5 distinct emojis × 2–4 people each → at least 6 reactions.
    for (const emoji of shuffled(HL_EMOJIS).slice(0, 3 + Math.floor(Math.random() * 3))) {
      const n = 2 + Math.floor(Math.random() * 3);
      for (let k = 0; k < n; k++) {
        await db
          .insert(chatReactions)
          .values({ messageId: msg.id, sessionId: `seed-r-${msg.id}-${emoji}-${k}`, name: pick(DEMO_NAMES), emoji })
          .onConflictDoNothing();
      }
    }
  }
  // Nudge listeners (highlights tile, chat panel) per inserted message —
  // each event carries the real id so chat-side updaters can fetch only
  // what they need rather than refetching the world.
  for (const id of inserted) {
    await broadcastToRoom(room.code, { type: "chat:new", id, quiet: true });
    await broadcastToRoom(room.code, { type: "chat:react", id });
  }
  return NextResponse.json({ ok: true, created: count });
}
