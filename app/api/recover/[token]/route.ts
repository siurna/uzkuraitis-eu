import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { voters } from "@/lib/db/schema";
import { findRoomByCode } from "@/lib/rooms";
import { verifyRecoveryToken } from "@/lib/recovery-token";
import {
  isSessionAuthAvailable,
  signSession,
  RESERVED_SESSIONS,
} from "@/lib/session-auth";
import { SESSION_COOKIE_NAME } from "@/lib/server-session";

// Redeem a recovery token: validate the HMAC + expiry, confirm the
// voter row still exists in the room, mint the signed session cookie
// and return the identity payload so the client can rebuild
// localStorage and bounce into the room.
//
// POST (not GET) so the URL doesn't sit in browser referrer headers /
// shared screenshots; the token only ever travels in the request
// body. The recovery page (app/recover/[token]/page.tsx) posts it.

type RouteCtx = { params: Promise<{ token: string }> };

export async function POST(_req: Request, { params }: RouteCtx) {
  if (!isSessionAuthAvailable()) {
    return NextResponse.json(
      { error: "Recovery is disabled (session secret not configured)." },
      { status: 503 },
    );
  }
  const { token } = await params;
  const claims = verifyRecoveryToken(token);
  if (!claims) {
    return NextResponse.json(
      { error: "Link is invalid or expired." },
      { status: 400 },
    );
  }
  if (RESERVED_SESSIONS.has(claims.sid)) {
    return NextResponse.json({ error: "Invalid recovery target." }, { status: 400 });
  }

  const room = await findRoomByCode(claims.room);
  if (!room) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }

  // Re-verify the voter row still exists. Catches the "admin deleted
  // this voter after the link was minted" case so we don't hand back
  // a session pointing at a ghost row.
  const [voter] = await db
    .select({
      id: voters.id,
      sessionId: voters.sessionId,
      name: voters.name,
      avatarId: voters.avatarId,
    })
    .from(voters)
    .where(
      and(
        eq(voters.id, claims.vid),
        eq(voters.roomId, room.id),
        eq(voters.sessionId, claims.sid),
      ),
    )
    .limit(1);
  if (!voter) {
    return NextResponse.json({ error: "Voter no longer in this room." }, { status: 404 });
  }

  const cookieValue = signSession(voter.sessionId);
  const res = NextResponse.json({
    sessionId: voter.sessionId,
    name: voter.name,
    avatarId: voter.avatarId,
    roomCode: room.code,
  });
  res.cookies.set(SESSION_COOKIE_NAME, cookieValue, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return res;
}

export const dynamic = "force-dynamic";
