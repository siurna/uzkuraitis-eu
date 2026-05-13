// HMAC-signed session tokens. The browser stores a 12-char anonymous
// sessionId in localStorage; the server mints a signed cookie that binds
// to that id. Every per-session write (chat post, vote, reaction,
// trivia answer …) verifies the cookie before accepting the body's
// `session` field. Without this, anyone with the room code could read
// another participant's sessionId from Liveblocks presence and POST as
// them.
//
// The HMAC secret lives in UZK_SESSION_SECRET. If missing we fail
// *open* — local dev shouldn't be hostile — but log a hard warning so
// production deploys don't ship without it. The /api/identity route
// surfaces this state too: it'll mint cookies when the secret is set
// and noop when it isn't.

import { createHmac, timingSafeEqual } from "node:crypto";

const SECRET = process.env.UZK_SESSION_SECRET;
let warnedMissing = false;

export function isSessionAuthAvailable(): boolean {
  if (!SECRET && !warnedMissing) {
    warnedMissing = true;
    console.warn(
      "[session-auth] UZK_SESSION_SECRET is not set — signed sessions are disabled. " +
        "Set it in production to defend against chat impersonation.",
    );
  }
  return !!SECRET;
}

function hmacFor(sessionId: string): string {
  if (!SECRET) throw new Error("UZK_SESSION_SECRET not configured");
  return createHmac("sha256", SECRET).update(sessionId).digest("base64url");
}

// "<sessionId>.<base64url(hmac)>" — short enough to fit in a cookie
// header and self-contained so verification is a single HMAC compute.
export function signSession(sessionId: string): string {
  return `${sessionId}.${hmacFor(sessionId)}`;
}

// Returns the sessionId the cookie attests to, or null if the token is
// missing / malformed / forged.
export function verifySessionToken(token: string | undefined | null): string | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot < 1) return null;
  const sid = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!sid || !sig) return null;
  try {
    const expected = hmacFor(sid);
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return null;
    return timingSafeEqual(a, b) ? sid : null;
  } catch {
    return null;
  }
}

// Session ids reserved for internal helpers (system / commentator
// messages, the future trivia bot). Refuse to sign these so a client
// can't trick the API into accepting an impersonating cookie.
export const RESERVED_SESSIONS = new Set(["system", "commentator"]);
