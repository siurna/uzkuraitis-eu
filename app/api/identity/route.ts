import { NextResponse } from "next/server";
import { z } from "zod";
import {
  isSessionAuthAvailable,
  signSession,
  RESERVED_SESSIONS,
} from "@/lib/session-auth";
import { SESSION_COOKIE_NAME } from "@/lib/server-session";

// POST /api/identity
//
// Body: { sessionId }
// Idempotent: mints (or refreshes) the signed session cookie that binds
// the browser's anonymous sessionId. RoomShell calls this on every
// mount, so returning users without a cookie get one the next time
// they open a room.
//
// When UZK_SESSION_SECRET isn't configured we return `signed: false` and
// don't set a cookie — the server-side guard fails open in that mode.

const Body = z.object({
  sessionId: z
    .string()
    .min(8)
    .max(64)
    // sessionIds from lib/use-identity.ts are `s_<12 base36 chars>`.
    // Anchor the regex tightly so a malicious client can't smuggle in
    // a "session" value with characters that confuse downstream code.
    .regex(/^[a-z0-9_-]+$/i),
});

export async function POST(req: Request) {
  if (!isSessionAuthAvailable()) {
    return NextResponse.json({ ok: true, signed: false });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const sessionId = parsed.data.sessionId;
  if (RESERVED_SESSIONS.has(sessionId)) {
    return NextResponse.json(
      { error: "Reserved session id" },
      { status: 400 },
    );
  }

  const token = signSession(sessionId);
  const res = NextResponse.json({ ok: true, signed: true });
  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return res;
}

export const dynamic = "force-dynamic";
