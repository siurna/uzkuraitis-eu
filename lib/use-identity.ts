"use client";

import { useCallback, useEffect, useState } from "react";
import { getAvatar, type Avatar } from "@/lib/avatars";

// Single source of truth for "who am I" — name, avatar id, and the
// anonymous session id — backed by localStorage. Everything that used
// to read `localStorage.getItem("uzk_name" | "uzk_avatar" | "uzk_session")`
// ad-hoc (chat, vote form, bingo, presence bar, settings…) should use
// this hook instead.
//
// `name`/`avatarId` are reactive: they update on cross-tab `storage`
// events and on the same-tab `uzk:avatar-change` event that `setName`/
// `setAvatar` (and the name gate) dispatch. `sessionId()` is a stable
// getter — it lazily mints + persists an id on first call.

export const NAME_KEY = "uzk_name";
export const AVATAR_KEY = "uzk_avatar";
export const SESSION_KEY = "uzk_session";
export const IDENTITY_EVENT = "uzk:avatar-change";

export function ensureSessionId(): string {
  if (typeof window === "undefined") return "";
  let s = window.localStorage.getItem(SESSION_KEY);
  if (!s) {
    s = `s_${Math.random().toString(36).slice(2, 14)}`;
    window.localStorage.setItem(SESSION_KEY, s);
  }
  return s;
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
