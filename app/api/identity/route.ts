import { NextResponse } from "next/server";
import { z } from "zod";
import {
  isSessionAuthAvailable,
  signSession,
  RESERVED_SESSIONS,
} from "@/lib/session-auth";
import { SESSION_COOKIE_NAME } from "@/lib/server-session";
import { checkAndIncrement } from "@/lib/rate-limit";

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

  // SHOW-DAY GUARD: cap signed-session minting per IP. Without this,
  // a hostile client rolling fresh sessionIds + posting one for each
  // could bypass the per-session chat / vote / reaction rate limits
  // entirely (the rate-limit bucket key is the sessionId, so each
  // fresh one was a fresh bucket). 20 fresh sessions per IP per
  // minute is generous for normal use (a phone + tablet + laptop
  // and a few reloads) while making any practical flood pathway
  // arithmetically uninteresting. Falls back open if the rate-limit
  // table is unreachable rather than locking real users out.
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";
    const rl = await checkAndIncrement(`identity:${ip}`, 20, 60_000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Slow down — too many session refreshes." },
        { status: 429 },
      );
    }
  } catch {
    /* table down, fail open */
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
