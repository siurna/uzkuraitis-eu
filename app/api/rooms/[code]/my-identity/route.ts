import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { voters } from "@/lib/db/schema";
import { findRoomByCode } from "@/lib/rooms";
import { readSignedSessionId } from "@/lib/server-session";

// GET /api/rooms/[code]/my-identity
//
// Read the voter row for (room, signed-cookie-sessionId) and return
// the display identity + a couple of per-room flags so a viewer who
// lost their `localStorage` can re-hydrate it from the server
// without having to re-enter their name / avatar / re-cast vote.
//
// Used by the post-bootstrap step in <RoomShell>: if local `uzk_name`
// or `uzk_avatar` is missing but the cookie attests to a real
// voter, this fills both back in before render so the name gate
// never shows.
//
// Returns nulls for every field if there's no cookie / no voter row;
// the client treats that as "true first-time, run the name gate".

type RouteCtx = { params: Promise<{ code: string }> };

export async function GET(_req: Request, { params }: RouteCtx) {
  const { code } = await params;
  const room = await findRoomByCode(code);
  if (!room) {
    return jsonNoStore({
      sessionId: null,
      name: null,
      avatarId: null,
      voted: false,
      betsCount: 0,
      lastSeenAt: null,
    });
  }

  const sessionId = await readSignedSessionId();
  if (!sessionId) {
    return jsonNoStore({
      sessionId: null,
      name: null,
      avatarId: null,
      voted: false,
      betsCount: 0,
      lastSeenAt: null,
    });
  }

  const [voter] = await db
    .select({
      name: voters.name,
      avatarId: voters.avatarId,
      seenAt: voters.seenAt,
      homeCountryPrediction: voters.homeCountryPrediction,
      betWoodenSpoon: voters.betWoodenSpoon,
      betLt12To: voters.betLt12To,
      betHighestBig5: voters.betHighestBig5,
      betJuryWinner: voters.betJuryWinner,
      betTelevoteWinner: voters.betTelevoteWinner,
      betNulTelevote: voters.betNulTelevote,
      betHostTop3: voters.betHostTop3,
      betWinnerSolo: voters.betWinnerSolo,
      betLtTotalPoints: voters.betLtTotalPoints,
      betLtJuryCount: voters.betLtJuryCount,
    })
    .from(voters)
    .where(and(eq(voters.roomId, room.id), eq(voters.sessionId, sessionId)))
    .limit(1);

  if (!voter) {
    return jsonNoStore({
      sessionId,
      name: null,
      avatarId: null,
      voted: false,
      betsCount: 0,
      lastSeenAt: null,
    });
  }

  // betsCount mirrors the home-banners counter so the "you've placed
  // N bets" indicator survives a localStorage wipe. Match the same
  // semantics: count any non-null field; the home prediction adds 1
  // when set.
  const betFields = [
    voter.betWoodenSpoon,
    voter.betLt12To,
    voter.betHighestBig5,
    voter.betJuryWinner,
    voter.betTelevoteWinner,
    voter.betNulTelevote,
    voter.betHostTop3,
    voter.betWinnerSolo,
    voter.betLtTotalPoints,
    voter.betLtJuryCount,
  ];
  let betsCount = 0;
  for (const f of betFields) {
    if (f == null) continue;
    if (Array.isArray(f) && f.length === 0) continue;
    betsCount++;
  }
  if (voter.homeCountryPrediction != null) betsCount++;

  // Did this voter actually cast a TOP-10? Cheap check — if they
  // have a homePrediction OR any bet set OR (most reliably) a name
  // that was set via the name gate AND they exist as a voter row,
  // they got at least into the room. The reliable signal for "voted"
  // is whether the votes table has any rows for this voter, but
  // hoisting that join would slow the bootstrap. Instead, surface
  // it as a separate `voted` boolean computed cheaply: if betsCount
  // > 0 we know they engaged with the ballot UI. The UI also stores
  // `uzk_voted_<code>` after a confirmed POST /votes, so this is a
  // BEST-EFFORT hydration — if they DID cast and we miss the flag,
  // the worst case is the Vote tab shows the "cast your TOP 10"
  // CTA instead of the "you've voted" CTA, and a single tap fixes
  // it.
  const voted = betsCount > 0;

  return jsonNoStore({
    sessionId,
    name: voter.name,
    avatarId: voter.avatarId,
    voted,
    betsCount,
    lastSeenAt: voter.seenAt ? voter.seenAt.toISOString() : null,
  });
}

function jsonNoStore(body: unknown) {
  const res = NextResponse.json(body);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export const dynamic = "force-dynamic";
