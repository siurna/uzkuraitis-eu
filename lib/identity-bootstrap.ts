// Cookie-first identity bootstrap.
//
// The story: localStorage on iOS Safari (especially in PWA standalone
// mode) gets evicted under memory pressure / storage-tier panic /
// ITP cleanup. Cookies are durable across the same events. Today
// `ensureSessionId()` (lib/use-identity.ts) only reads localStorage,
// so any time localStorage hiccups while the cookie is alive, the
// client mints a brand new sessionId and the user appears "logged
// out" with all their votes / chat / score attached to a sid the
// running app no longer knows.
//
// This module runs ONCE on first mount via `bootstrapIdentity()`,
// reconciles `localStorage.uzk_session` against the cookie's
// authoritative sid (via `GET /api/identity`), and caches the
// resolved sid in memory for the rest of the page lifetime. After
// bootstrap, NOTHING re-reads localStorage for the sessionId —
// `getSessionId()` returns from the in-memory cache, so a mid-
// session localStorage eviction can't reset anyone's identity.
//
// Reconciliation rules (mismatch is rare; the safe default is
// "localStorage wins" so a user with a stale cookie never gets
// pulled out from under their per-room state):
//
//   cookie ✓ + local ✓ (match)     → use as-is, no writes
//   cookie ✓, local ✗              → restore from cookie, write local
//   cookie ✗, local ✓              → use local, re-sign cookie
//   cookie ✓, local ✓ (mismatch)   → use local, re-sign cookie to match,
//                                    log a warn for telemetry
//   cookie ✗, local ✗              → mint fresh, sign cookie

"use client";

export const SESSION_KEY = "uzk_session";
export const NAME_KEY = "uzk_name";
export const AVATAR_KEY = "uzk_avatar";

export type ResolvedIdentity = {
  sessionId: string;
  name: string | null;
  avatarId: string | null;
  /** True if we minted a brand-new session this bootstrap (no cookie + no local). */
  mintedFresh: boolean;
};

let bootstrapPromise: Promise<ResolvedIdentity> | null = null;
let cachedIdentity: ResolvedIdentity | null = null;

// Sync getter for non-React modules (broadcast helpers, etc).
// Throws if called before bootstrap resolves; that's intentional —
// silently falling back to localStorage was the original bug.
export function getSessionId(): string {
  if (!cachedIdentity) {
    throw new Error(
      "[identity] getSessionId() called before bootstrapIdentity() resolved",
    );
  }
  return cachedIdentity.sessionId;
}

// Non-throwing variant for the rare pre-bootstrap call sites.
export function peekSessionId(): string | null {
  return cachedIdentity?.sessionId ?? null;
}

export function bootstrapIdentity(): Promise<ResolvedIdentity> {
  if (bootstrapPromise) return bootstrapPromise;
  bootstrapPromise = (async () => {
    const localSid = readLocal(SESSION_KEY);

    // Step A: ask the server what the cookie attests to.
    // Hard timeout at 3s — beyond that we fall back to whatever
    // localStorage has so a flaky network doesn't trap users
    // at the loading screen.
    const serverSid = await fetchServerSid(3000);

    // Step B: reconcile.
    let sid: string;
    let needsSign = false;
    let mintedFresh = false;

    if (serverSid && localSid && serverSid !== localSid) {
      // Mismatch. Trust localStorage (the user's lived per-room
      // state references the local sid). Re-sign cookie to match.
      console.warn(
        "[identity] cookie/localStorage mismatch — trusting localStorage",
        { cookieSid: serverSid, localSid },
      );
      sid = localSid;
      needsSign = true;
    } else if (serverSid) {
      sid = serverSid;
    } else if (localSid) {
      sid = localSid;
      needsSign = true;
    } else {
      sid = mintFreshSid();
      needsSign = true;
      mintedFresh = true;
    }

    // Step C: write-through to localStorage. Best-effort.
    writeLocal(SESSION_KEY, sid);

    // Step D: if the cookie doesn't match the resolved sid, sign it.
    // POST is fire-and-forget but we await it on bootstrap so that
    // any race between bootstrap completing and the first per-session
    // write doesn't 401 on guardSession.
    if (needsSign) {
      try {
        await fetchSign(sid, 3000);
      } catch {
        // Network blip — retry on next user interaction so the user
        // can still operate; we just want the cookie eventually in
        // place. Subsequent per-session writes that need
        // guardSession will 401 until then; they'll naturally retry
        // on the user's next attempt.
        scheduleSignRetry(sid);
      }
    }

    cachedIdentity = {
      sessionId: sid,
      name: readLocal(NAME_KEY),
      avatarId: readLocal(AVATAR_KEY),
      mintedFresh,
    };
    return cachedIdentity;
  })();
  return bootstrapPromise;
}

// Refresh the in-memory name/avatar cache after the name gate /
// avatar picker writes them. React context picks this up via the
// existing `uzk:avatar-change` event in lib/use-identity.ts; this
// helper keeps the bootstrap cache in sync so `getSessionId()` +
// any future getName/getAvatar reads stay accurate.
export function updateCachedIdentity(patch: {
  name?: string | null;
  avatarId?: string | null;
}): void {
  if (!cachedIdentity) return;
  cachedIdentity = {
    ...cachedIdentity,
    name: patch.name !== undefined ? patch.name : cachedIdentity.name,
    avatarId:
      patch.avatarId !== undefined ? patch.avatarId : cachedIdentity.avatarId,
  };
}

// ── internals ───────────────────────────────────────────────────

async function fetchServerSid(timeoutMs: number): Promise<string | null> {
  try {
    const res = await fetch("/api/identity", {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    const data = (await res.json().catch(() => null)) as
      | { sessionId?: string | null }
      | null;
    return data?.sessionId ?? null;
  } catch {
    return null;
  }
}

async function fetchSign(sid: string, timeoutMs: number): Promise<void> {
  const res = await fetch("/api/identity", {
    method: "POST",
    headers: { "content-type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ sessionId: sid }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok && res.status !== 429) {
    throw new Error(`identity sign failed: ${res.status}`);
  }
}

let pendingRetry = false;
function scheduleSignRetry(sid: string) {
  if (pendingRetry) return;
  pendingRetry = true;
  const tryAgain = () => {
    pendingRetry = false;
    window.removeEventListener("pointerdown", tryAgain);
    window.removeEventListener("visibilitychange", tryAgain);
    fetchSign(sid, 3000).catch(() => scheduleSignRetry(sid));
  };
  window.addEventListener("pointerdown", tryAgain, { once: true });
  window.addEventListener("visibilitychange", tryAgain, { once: true });
  // Belt + braces: even with no user interaction, try again after
  // ~10s so an idle tab eventually catches up.
  window.setTimeout(tryAgain, 10_000);
}

function mintFreshSid(): string {
  // Same shape as the legacy mint in lib/use-identity.ts:
  // `s_` + 12 base36 chars from Math.random. Keeps the validator
  // regex on /api/identity happy without us having to update it.
  return `s_${Math.random().toString(36).slice(2, 14)}`;
}

function readLocal(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocal(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* private mode / quota — cookie is still authoritative */
  }
}
