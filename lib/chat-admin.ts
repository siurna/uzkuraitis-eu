// Chat moderator mode — a private, opt-in admin powerup for the show
// runner. There is NO public admin account or UI; the moderator types
// a server-known secret as a chat message and the server intercepts it
// (the message itself never lands in chat), sets an httpOnly cookie,
// and from then on the moderator can delete ANY message in the room
// (including system / commentator broadcasts) via the existing chat
// DELETE endpoint. Typing the same secret again revokes the powerup.
//
// Why a cookie, not a row: there's exactly one moderator profile and
// the grant lasts ~one event night. Cookie state is trivial, survives
// reload, and the secret itself never leaves the server (it's stored
// in the cookie BUT the cookie is httpOnly so JS can't read it, and
// it never round-trips through the client API). Server-side helpers
// validate by comparing the cookie value to process.env.
//
// The client carries a parallel localStorage hint
// (`uzk_chat_admin = "1"`) so the UI can show the small dot on the
// avatar — but every delete is re-validated server-side from the
// cookie, so a tampered localStorage flag grants nothing.

export const CHAT_ADMIN_COOKIE = "uzk_chat_admin";

/** Minimum length for an effective secret. Refuse to act on env
 *  values shorter than this — protects against an accidentally-empty
 *  env var matching every empty-body message. */
export const MIN_SECRET_LENGTH = 6;

/** The configured server-side secret. `null` when the env var is
 *  unset / too short → moderation feature is dormant. */
export function chatAdminSecret(): string | null {
  const s = process.env.CHAT_ADMIN_SECRET;
  if (!s || s.length < MIN_SECRET_LENGTH) return null;
  return s;
}

/** Constant-time-ish string compare. Short-circuiting `===` would
 *  leak prefix-match timing; this loop walks both strings fully. */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
