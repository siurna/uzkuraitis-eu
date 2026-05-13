"use client";

// Client-side helpers for the "auto-translate to English" feature: the
// toggle persists in localStorage (so it's pinned across reloads), and a
// custom event lets every chat row in the tab pick up a flip without
// waiting for the cross-tab `storage` event.
//
// The translation calls themselves live in <TranslateProvider>; this
// file only owns the setting + its watcher hook.

import { useEffect, useState } from "react";

export const TRANSLATE_KEY = "uzk_translate_to_en";
const TRANSLATE_EVENT = "uzk:translate-change";

export function readTranslate(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(TRANSLATE_KEY) === "1";
}

export function writeTranslate(on: boolean): void {
  if (typeof window === "undefined") return;
  if (on) window.localStorage.setItem(TRANSLATE_KEY, "1");
  else window.localStorage.removeItem(TRANSLATE_KEY);
  window.dispatchEvent(new CustomEvent(TRANSLATE_EVENT, { detail: on }));
}

export function useTranslateEnabled(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    setOn(readTranslate());
    const sync = () => setOn(readTranslate());
    const onStorage = (e: StorageEvent) => {
      if (e.key === TRANSLATE_KEY) sync();
    };
    window.addEventListener(TRANSLATE_EVENT, sync);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(TRANSLATE_EVENT, sync);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return on;
}
