"use client";

// Beginner mode toggle — per-user, lives in localStorage, same shape
// as translate-client. When on, every incoming chat message gets
// inspected for Eurovision references; if any are detected, a short
// explanation in the user's UI language renders under the bubble
// (parallel rail to the translate bubble, not a replacement).
//
// Available in BOTH languages: the explanation is generated in the
// user's own lang so a Lithuanian user reading "It's like Lordi" gets
// a Lithuanian gloss, and an English user reading the same line gets
// an English one.

import { useEffect, useState } from "react";

export const BEGINNER_KEY = "uzk_beginner_mode";
const BEGINNER_EVENT = "uzk:beginner-change";

export function readBeginner(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(BEGINNER_KEY) === "1";
}

export function writeBeginner(on: boolean): void {
  if (typeof window === "undefined") return;
  if (on) window.localStorage.setItem(BEGINNER_KEY, "1");
  else window.localStorage.removeItem(BEGINNER_KEY);
  window.dispatchEvent(new CustomEvent(BEGINNER_EVENT, { detail: on }));
}

export function useBeginnerEnabled(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    setOn(readBeginner());
    const sync = () => setOn(readBeginner());
    const onStorage = (e: StorageEvent) => {
      if (e.key === BEGINNER_KEY) sync();
    };
    window.addEventListener(BEGINNER_EVENT, sync);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(BEGINNER_EVENT, sync);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return on;
}
