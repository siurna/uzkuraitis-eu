// Lightweight EN/LT toggle. Persists the user's preference to
// localStorage as "uzk_lang" and exposes a tiny string lookup. Wired
// into the settings modal + name gate; full i18n of every string is
// out of scope for this hobby project, but the infra is here so we
// can grow into it.

export type Language = "en" | "lt";
export const LANGUAGES: Language[] = ["en", "lt"];
export const LANG_STORAGE_KEY = "uzk_lang";

const messages: Record<Language, Record<string, string>> = {
  en: {
    welcome: "Welcome",
    name_prompt: "What should we call you in this room?",
    your_name: "Your name",
    join_party: "Join the party",
    pick_avatar: "Pick an avatar (optional)",
    cast_vote: "Cast your vote",
    update_vote: "Update your vote",
    voting_closed: "Voting closed",
    submit_vote: "Submit my 12 points",
    settings: "Settings",
    language: "Language",
    share_link: "Share room link",
    save: "Save",
  },
  lt: {
    welcome: "Sveiki",
    name_prompt: "Kaip tave vadinsime šitam kambary?",
    your_name: "Tavo vardas",
    join_party: "Prisijunk",
    pick_avatar: "Pasirink avatarą (nebūtina)",
    cast_vote: "Balsuok",
    update_vote: "Pakeisk balsą",
    voting_closed: "Balsavimas baigtas",
    submit_vote: "Pateikti mano 12 taškų",
    settings: "Nustatymai",
    language: "Kalba",
    share_link: "Pasidalink kambariu",
    save: "Išsaugoti",
  },
};

export function t(lang: Language, key: keyof typeof messages.en): string {
  return messages[lang]?.[key] ?? messages.en[key] ?? key;
}

export function readLang(): Language {
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage.getItem(LANG_STORAGE_KEY);
  return stored === "lt" ? "lt" : "en";
}

export function writeLang(lang: Language): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LANG_STORAGE_KEY, lang);
}
