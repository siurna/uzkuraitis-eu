"use client";

import { useCallback, useEffect, useState } from "react";
import { getAvatar, type Avatar } from "@/lib/avatars";
import {
  peekSessionId,
  updateCachedIdentity,
} from "@/lib/identity-bootstrap";

// Single source of truth for "who am I" — name + avatar + the anonymous
// sessionId. The SESSION is resolved exclusively by the cookie-first
// bootstrap in `lib/identity-bootstrap.ts` and cached in memory there;
// `ensureSessionId()` is a thin read-through into that cache (with
// localStorage as a fall-back read, never a write/mint).
//
// Name + avatar are still localStorage-backed and reactive across tabs
// (storage event) and in-tab (`uzk:avatar-change` event the name gate /
// avatar picker dispatch via setName / setAvatar).
//
// Why the session can't mint here anymore: the legacy "mint on first
// call" path was the source of every "anonymous logged out" incident.
// If localStorage was empty for any reason — iOS storage-tier
// eviction, PWA partition reset, a transient browser bug —
// `ensureSessionId()` would lazily mint a NEW sessionId, orphaning
// the user's voter row + chat + bets behind a cookie that the
// running client no longer knew about. Minting now happens ONCE on
// app boot inside the bootstrap, and never again.

export const NAME_KEY = "uzk_name";
export const AVATAR_KEY = "uzk_avatar";
export const SESSION_KEY = "uzk_session";
export const IDENTITY_EVENT = "uzk:avatar-change";

// Read-only sessionId getter. Prefers the bootstrap's in-memory
// cache; falls back to localStorage if (for whatever reason) the
// bootstrap hasn't resolved yet on this caller's path. Returns ""
// only when the bootstrap hasn't run AND localStorage was empty,
// which should never happen below the IdentityProvider — we log a
// warn so any regression is loud.
export function ensureSessionId(): string {
  if (typeof window === "undefined") return "";
  const cached = peekSessionId();
  if (cached) return cached;
  try {
    const local = window.localStorage.getItem(SESSION_KEY);
    if (local) return local;
  } catch {
    /* localStorage unavailable (private mode, quota) */
  }
  if (process.env.NODE_ENV !== "production") {
    console.warn(
      "[identity] ensureSessionId() called before bootstrap resolved — returning empty",
    );
  }
  return "";
}

// Legacy fire-and-forget cookie-mint helper. Kept as a no-op so any
// stragglers that still import it don't break; the bootstrap is now
// the only path that signs cookies.
export function mintSignedSession(): void {
  /* no-op — bootstrap handles cookie minting on first mount */
}

export type Identity = {
  /** Display name, "" if not set yet. */
  name: string;
  /** Avatar id from lib/avatars.ts, or null for the fallback tile. */
  avatarId: string | null;
  /** Resolved avatar record (photo, country, artist…), or null. */
  avatar: Avatar | null;
  /** Stable anonymous session id (minted + persisted on first read). */
  sessionId: () => string;
  setName: (name: string) => void;
  setAvatar: (avatarId: string | null) => void;
  /** Set both at once + persist + notify. */
  setIdentity: (next: { name?: string; avatarId?: string | null }) => void;
};

export function useIdentity(): Identity {
  const [name, setNameState] = useState("");
  const [avatarId, setAvatarIdState] = useState<string | null>(null);

  useEffect(() => {
    ensureSessionId();
    mintSignedSession();
    const read = () => {
      setNameState(window.localStorage.getItem(NAME_KEY) ?? "");
      setAvatarIdState(window.localStorage.getItem(AVATAR_KEY));
    };
    read();
    const onStorage = (e: StorageEvent) => {
      if (e.key === NAME_KEY || e.key === AVATAR_KEY) read();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(IDENTITY_EVENT, read);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(IDENTITY_EVENT, read);
    };
  }, []);

  const setIdentity = useCallback(
    (next: { name?: string; avatarId?: string | null }) => {
      if (typeof window === "undefined") return;
      if (next.name !== undefined) {
        window.localStorage.setItem(NAME_KEY, next.name);
        setNameState(next.name);
      }
      if (next.avatarId !== undefined) {
        if (next.avatarId === null) window.localStorage.removeItem(AVATAR_KEY);
        else window.localStorage.setItem(AVATAR_KEY, next.avatarId);
        setAvatarIdState(next.avatarId);
      }
      // Mirror to the bootstrap's in-memory cache so any module that
      // reads name/avatar via the bootstrap getter sees the update
      // without waiting for the storage / IDENTITY_EVENT round-trip.
      updateCachedIdentity({
        name: next.name,
        avatarId: next.avatarId,
      });
      window.dispatchEvent(new Event(IDENTITY_EVENT));
    },
    [],
  );

  const setName = useCallback((n: string) => setIdentity({ name: n }), [setIdentity]);
  const setAvatar = useCallback(
    (a: string | null) => setIdentity({ avatarId: a }),
    [setIdentity],
  );

  return {
    name,
    avatarId,
    avatar: getAvatar(avatarId),
    sessionId: ensureSessionId,
    setName,
    setAvatar,
    setIdentity,
  };
}
