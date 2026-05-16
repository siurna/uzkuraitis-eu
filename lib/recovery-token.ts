// HMAC-signed recovery tokens. Encoded payload + base64url HMAC, all
// in one URL-safe string. Used by the admin "recovery link" feature
// (lib/admin generates one per voter; participant opens
// /recover/<token>, server re-mints the session cookie and writes
// their sessionId / name / avatar back to localStorage so a deleted
// PWA / cleared storage can be brought back without a re-name).
//
// Payload:
//   { sid: <sessionId>, vid: <voterId>, room: <roomCode>, exp: <unix-seconds> }
// Format: base64url(JSON(payload)) + "." + base64url(hmac(payload))
// HMAC: SHA-256 over the base64url(JSON(payload)) bytes, using the
// same UZK_SESSION_SECRET that signs the regular session cookie.
//
// Tokens are NOT one-time-use: a participant who deletes the PWA
// twice can use the same link twice within the expiry window. Trade
// vs revocation complexity: short expiry (default 24h) bounds the
// blast radius if a link leaks, and the admin can always mint a
// fresh one. If we ever need single-use, a `recovery_tokens` table
// with `consumed_at` is the natural place to add it later.

import { createHmac, timingSafeEqual } from "node:crypto";

const SECRET = process.env.UZK_SESSION_SECRET;
const DEFAULT_TTL_SECONDS = 24 * 60 * 60;

export type RecoveryClaims = {
  sid: string;
  vid: string;
  room: string;
  exp: number;
};

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString("base64url");
}

function b64urlDecode(s: string): Buffer | null {
  try {
    return Buffer.from(s, "base64url");
  } catch {
    return null;
  }
}

function hmac(payload: string): string {
  if (!SECRET) throw new Error("UZK_SESSION_SECRET not configured");
  return createHmac("sha256", SECRET).update(payload).digest("base64url");
}

export function isRecoveryAvailable(): boolean {
  return !!SECRET;
}

export function signRecoveryToken(
  claims: Omit<RecoveryClaims, "exp">,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload: RecoveryClaims = { ...claims, exp };
  const body = b64url(JSON.stringify(payload));
  return `${body}.${hmac(body)}`;
}

export function verifyRecoveryToken(token: string | null | undefined): RecoveryClaims | null {
  if (!token || !SECRET) return null;
  const dot = token.lastIndexOf(".");
  if (dot < 1) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!body || !sig) return null;
  let expectedSig: string;
  try {
    expectedSig = hmac(body);
  } catch {
    return null;
  }
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const decoded = b64urlDecode(body);
  if (!decoded) return null;
  let claims: RecoveryClaims;
  try {
    claims = JSON.parse(decoded.toString("utf8")) as RecoveryClaims;
  } catch {
    return null;
  }
  if (
    typeof claims.sid !== "string" ||
    typeof claims.vid !== "string" ||
    typeof claims.room !== "string" ||
    typeof claims.exp !== "number"
  ) {
    return null;
  }
  if (claims.exp * 1000 < Date.now()) return null;
  return claims;
}
