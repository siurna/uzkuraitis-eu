import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  isSessionAuthAvailable,
  verifySessionToken,
} from "@/lib/session-auth";

// Server-side helper for route handlers. The signed cookie is the
// authoritative identity — the body's `session` field is treated as a
// claim the cookie must back up.
//
// Fail-closed in production, fail-open in dev: if UZK_SESSION_SECRET is
// missing, every check passes so local development isn't hostile.
// `isSessionAuthAvailable()` logs once on first read.

const COOKIE_NAME = "uzk_sig";

export async function readSignedSessionId(): Promise<string | null> {
  if (!isSessionAuthAvailable()) return null;
  const jar = await cookies();
  return verifySessionToken(jar.get(COOKIE_NAME)?.value);
}

// Compare the claimed session against the signed cookie. Returns null
// on success; the route handler returns the response on failure.
//
//   const guard = await guardSession(claimedSession);
//   if (guard) return guard;
export async function guardSession(
  claimedSession: string,
): Promise<NextResponse | null> {
  if (!isSessionAuthAvailable()) return null; // dev fail-open
  const verified = await readSignedSessionId();
  if (!verified) {
    return NextResponse.json(
      { error: "Sign in first — reload the room to refresh your session." },
      { status: 401 },
    );
  }
  if (verified !== claimedSession) {
    return NextResponse.json(
      { error: "Session mismatch." },
      { status: 401 },
    );
  }
  return null;
}

// For endpoints with no body session (e.g. image upload) — just require
// the caller to be SOMEONE with a signed cookie. Returns null on
// success, an error response on failure.
export async function guardAnySession(): Promise<NextResponse | null> {
  if (!isSessionAuthAvailable()) return null;
  const verified = await readSignedSessionId();
  if (!verified) {
    return NextResponse.json(
      { error: "Sign in first — reload the room." },
      { status: 401 },
    );
  }
  return null;
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
