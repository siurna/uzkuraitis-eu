"use client";

// Browser-only glue for ./i18n.ts — the language toggle persists in
// localStorage and broadcasts a custom event so multiple components in
// the same tab pick the change up without waiting for the cross-tab
// `storage` event.

import { useEffect, useState } from "react";
import { LANG_STORAGE_KEY, type Language } from "./i18n";

const LANG_CHANGE_EVENT = "uzk:lang-change";

export function readLang(): Language {
  if (typeof window === "undefined") return "lt";
  // LT is the default; only an explicit "en" switches.
  return window.localStorage.getItem(LANG_STORAGE_KEY) === "en" ? "en" : "lt";
}

export function writeLang(lang: Language): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LANG_STORAGE_KEY, lang);
  window.dispatchEvent(new CustomEvent(LANG_CHANGE_EVENT, { detail: lang }));
}

export function useLang(): Language {
  const [lang, setLang] = useState<Language>("lt");
  useEffect(() => {
    setLang(readLang());
    const onChange = () => setLang(readLang());
    const onStorage = (e: StorageEvent) => {
      if (e.key === LANG_STORAGE_KEY) onChange();
    };
    window.addEventListener(LANG_CHANGE_EVENT, onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(LANG_CHANGE_EVENT, onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return lang;
}
