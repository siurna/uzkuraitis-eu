import { NextResponse } from "next/server";
import { z } from "zod";
import {
  isSessionAuthAvailable,
  signSession,
  RESERVED_SESSIONS,
} from "@/lib/session-auth";
import {
  SESSION_COOKIE_NAME,
  readSignedSessionId,
} from "@/lib/server-session";
import { checkAndIncrement } from "@/lib/rate-limit";

// GET /api/identity
//
// Read-only: returns the sessionId already attested to by the signed
// `uzk_sig` cookie. The client-side bootstrap (lib/identity-bootstrap.ts)
// calls this on first mount so it can RESTORE a sessionId whose
// localStorage cache was lost (iOS storage tier eviction, PWA
// partition reset, etc) while the cookie survived.
//
// Single HMAC verify, no DB. `Cache-Control: no-store` so a service
// worker or CDN never serves a stale identity to a different viewer.
export async function GET() {
  if (!isSessionAuthAvailable()) {
    const res = NextResponse.json({ sessionId: null, signed: false });
    res.headers.set("Cache-Control", "no-store");
    return res;
  }
  const sessionId = await readSignedSessionId();
  const res = NextResponse.json({ sessionId, signed: !!sessionId });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

// POST /api/identity
//
// Body: { sessionId }
// Mints (or refreshes) the signed session cookie that binds the
// browser's anonymous sessionId. The bootstrap calls this whenever
// it RESOLVES a sessionId that the cookie doesn't already attest to
// — either a fresh mint or a cookie-evicted localStorage restore.
//
// Migration-safe: we trust the body's claim and overwrite the cookie
// to match. Cookie-wins reconciliation can come later when 100% of
// clients are running the new bootstrap and know how to read this
// response. Today some clients still post-and-forget.
//
// When UZK_SESSION_SECRET isn't configured we return `signed: false`
// and don't set a cookie — the server-side guard fails open in that
// mode.

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
  const res = NextResponse.json({ ok: true, signed: true, sessionId });
  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export const dynamic = "force-dynamic";
