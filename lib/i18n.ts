// EN/LT translations for every user-facing string. Admin pages stay
// English on purpose (the admin is one or two power-users; not worth
// the maintenance overhead). The voter-side surface — NameGate,
// SettingsModal, RoomGate, Standings, Leaderboard, VoteForm,
// BonusBetsForm, CountryDrawer, FloatingReactions, scoreboard pops —
// reads from t() and switches the moment the user picks a language.

export type Language = "en" | "lt";
export const LANGUAGES: Language[] = ["en", "lt"];
export const LANG_STORAGE_KEY = "uzk_lang";

export type MessageKey = keyof typeof messages.en;

const messages = {
  en: {
    // NameGate / SettingsModal
    welcome:           "Welcome",
    name_prompt:       "What should we call you in this room?",
    your_name:         "Your name",
    join_party:        "Join the party",
    pick_avatar:       "Pick an avatar",
    settings:          "Settings",
    language:          "Language",
    share_link:        "Share room link",
    save:              "Save",
    cancel:            "Cancel",
    clear:             "Clear",
    next:              "Next",
    back:              "Back",

    // RoomGate (entrance code screen)
    enter_room_code:   "Enter room code",
    enter_room:        "Enter room",
    checking:          "Checking…",
    bad_code:          "No room with that code.",
    bad_format:        "Codes are 6 characters (A–Z, 2–9).",
    reconnecting:      "Reconnecting…",

    // Standings
    no_votes_yet:      "No votes yet, be the first.",
    show_top_5:        "Top 5 only",
    show_all:          "Show all",
    votes_cast:        "Votes cast",
    pts_short:         "pts",
    cast_vote:         "Cast your vote",
    update_vote:       "Update your vote",
    voting_closed:     "Voting closed",
    live:              "Live",
    standings:         "Standings",

    // VoteForm
    cast_your_vote:    "Cast your vote",
    your_top_10:       "Your top 10",
    tap_to_pick:       "Tap to pick",
    drag_hint:         "Tap a slot to pick, drag to reorder.",
    submit_12:         "Submit my 12 points",
    pick_n_more:       (n: number) => `Pick ${n} more`,
    submitting:        "Submitting…",
    fill_n_more:       (n: number) => `Fill all 10 slots, ${n} to go.`,
    add_name_first:    "Add your name first.",
    voted_toast:       "Vote in. Long live music!",
    couldnt_submit:    "Couldn't submit vote.",

    // Tabs in vote form
    tab_ballot:        "Ballot",
    tab_bets:          "Bets",
    bonus_bets:        "Bonus bets",

    // Bonus bets — labels + descriptions
    bet_lt_placement:  "{home} placement",
    bet_lt_placement_sub:
      "Closer guesses score more. Exact +10, off-by-1 +7, off-by-2 +5, off by 3-5 +3, off by 6-10 +1.",
    bet_wooden_spoon:  "Wooden spoon",
    bet_wooden_spoon_sub:
      "Who finishes last? Exact +5, off-by-1 +2.",
    bet_lt_12_to:      "12 from {home} to",
    bet_lt_12_to_sub:
      "Where does {home} give its 12 points? Exact +5.",
    bet_big5:          "Highest-placed Big 5",
    bet_big5_sub:
      "UK, Germany, France, Italy, or Spain — which finishes best? +3.",
    bet_jury_winner:   "Jury winner",
    bet_jury_winner_sub: "The country that wins the jury vote. Exact +5.",
    bet_televote_winner: "Televote winner",
    bet_televote_winner_sub:
      "The country that wins the public televote. Exact +5.",
    bet_nul:           "Nul points (televote)",
    bet_nul_sub:
      "Pick any countries you think get zero from the public, or 'No country' if nobody scores zero. +4 per correct guess, capped at +12.",
    bet_lt_total:      "{home} total points",
    bet_lt_total_sub:
      "How many total points (jury + public) will {home} end up with? exact +10, ±5 +7, ±15 +5, ±30 +3, ±60 +1.",
    bet_same_winner:   "Same winner?",
    bet_same_winner_sub:
      "Does the same country win both jury and televote? Y/N +2.",
    bet_host_top3:     "{host} top 3?",
    bet_host_top3_sub:
      "Will the host country finish in the top 3? Y/N +3.",
    bet_solo_winner:   "Solo winner?",
    bet_solo_winner_sub:
      "Will the winner be a solo act (vs duo / group)? Y/N +2.",
    yes_short:         "yes",
    no_short:          "no",
    skip_short:        "—",
    max_pts:           (n: number) => `max +${n}`,
    no_country:        "No country",
    selected_count:    (n: number) => `${n} selected`,
    done:              "Done",

    // Leaderboard
    leaderboard:       "Leaderboard",
    finished:          "finished",
    ballot_label:      "ballot",
    bonuses_label:     "bonuses",
    breakdown_total:   "Total",

    // Reactions / honeycomb
    react_with:        (e: string) => `React with ${e}`,
  },
  lt: {
    // NameGate / SettingsModal
    welcome:           "Sveiki",
    name_prompt:       "Kaip tave vadinsim šitame kambary?",
    your_name:         "Tavo vardas",
    join_party:        "Prisijungti",
    pick_avatar:       "Pasirink avatarą",
    settings:          "Nustatymai",
    language:          "Kalba",
    share_link:        "Pasidalink kambariu",
    save:              "Išsaugoti",
    cancel:            "Atšaukti",
    clear:             "Išvalyti",
    next:              "Toliau",
    back:              "Atgal",

    enter_room_code:   "Įvesk kambario kodą",
    enter_room:        "Įeiti",
    checking:          "Tikrinama…",
    bad_code:          "Nėra kambario tokiu kodu.",
    bad_format:        "Kodas — 6 simboliai (A–Z, 2–9).",
    reconnecting:      "Jungiamasi…",

    no_votes_yet:      "Dar nėra balsų — būk pirmas.",
    show_top_5:        "Tik TOP 5",
    show_all:          "Visi",
    votes_cast:        "Balsai",
    pts_short:         "tšk",
    cast_vote:         "Balsuok",
    update_vote:       "Pakeisk balsą",
    voting_closed:     "Balsavimas baigtas",
    live:              "Tiesiogiai",
    standings:         "Rezultatai",

    cast_your_vote:    "Balsavimas",
    your_top_10:       "Tavo TOP 10",
    tap_to_pick:       "Bakstelėk pasirinkti",
    drag_hint:         "Bakstelėk vietą pasirinkti, vilk perstumti.",
    submit_12:         "Pateikti mano 12 taškų",
    pick_n_more:       (n: number) => `Dar ${n}`,
    submitting:        "Siunčiama…",
    fill_n_more:       (n: number) => `Užpildyk 10 vietų, dar ${n}.`,
    add_name_first:    "Pirma įvesk vardą.",
    voted_toast:       "Balsas užfiksuotas. Tegyvuoja muzika!",
    couldnt_submit:    "Nepavyko išsiųsti balso.",

    tab_ballot:        "Balsas",
    tab_bets:          "Statymai",
    bonus_bets:        "Bonus statymai",

    bet_lt_placement:  "{home} vieta",
    bet_lt_placement_sub:
      "Tiksliau spėtum — daugiau taškų. Tiksli +10, ±1 +7, ±2 +5, ±3-5 +3, ±6-10 +1.",
    bet_wooden_spoon:  "Paskutinė vieta",
    bet_wooden_spoon_sub:
      "Kas baigs paskutinis? Tiksli +5, gretimo +2.",
    bet_lt_12_to:      "{home} 12 taškų skirs",
    bet_lt_12_to_sub:
      "Kuriai šaliai {home} skirs 12 taškų? Tiksli +5.",
    bet_big5:          "Aukščiausia Big 5 vieta",
    bet_big5_sub:
      "Iš UK, Vokietijos, Prancūzijos, Italijos, Ispanijos — kas užims aukščiausią vietą? +3.",
    bet_jury_winner:   "Žiuri nugalėtojas",
    bet_jury_winner_sub: "Šalis, kurią išrinks žiuri. Tiksli +5.",
    bet_televote_winner: "Žiūrovų nugalėtojas",
    bet_televote_winner_sub:
      "Šalis, kuri laimės žiūrovų balsavimą. Tiksli +5.",
    bet_nul:           "Nul taškų (žiūrovai)",
    bet_nul_sub:
      "Pasirink šalis, kurios negaus nė vieno taško iš žiūrovų, arba 'Nė viena' jeigu visi gaus. +4 už kiekvieną pataikymą, max +12.",
    bet_lt_total:      "{home} bendra taškų suma",
    bet_lt_total_sub:
      "Kiek iš viso taškų (žiuri + žiūrovai) surinks {home}? Tiksli +10, ±5 +7, ±15 +5, ±30 +3, ±60 +1.",
    bet_same_winner:   "Tas pats nugalėtojas?",
    bet_same_winner_sub:
      "Ar ta pati šalis laimės žiuri ir žiūrovų balsavimus? Taip/ne +2.",
    bet_host_top3:     "{host} TOP 3?",
    bet_host_top3_sub:
      "Ar šeimininkų šalis pateks į TOP 3? Taip/ne +3.",
    bet_solo_winner:   "Solo atlikėjas laimės?",
    bet_solo_winner_sub:
      "Ar laimės solinis atlikėjas (ne duetas / grupė)? Taip/ne +2.",
    yes_short:         "taip",
    no_short:          "ne",
    skip_short:        "—",
    max_pts:           (n: number) => `iki +${n}`,
    no_country:        "Nė viena",
    selected_count:    (n: number) => `pasirinkta ${n}`,
    done:              "Gerai",

    leaderboard:       "Lyderiai",
    finished:          "užėmė",
    ballot_label:      "balsas",
    bonuses_label:     "statymai",
    breakdown_total:   "Iš viso",

    react_with:        (e: string) => `Reaguoti su ${e}`,
  },
} as const;

type EnMessages = typeof messages.en;

// Overload so static keys (e.g. "save") return string and function-keys
// (e.g. "pick_n_more") still type-check when called.
export function t<K extends MessageKey>(
  lang: Language,
  key: K,
  ...args: EnMessages[K] extends (...a: infer A) => string ? A : []
): string {
  const map = (messages[lang] ?? messages.en) as EnMessages;
  const value = map[key] ?? messages.en[key];
  if (typeof value === "function") {
    return (value as (...a: unknown[]) => string)(...(args as unknown[]));
  }
  return value as string;
}

// Tiny templating: "{home} placement" + { home: "Lithuania" } -> "Lithuania placement".
export function fmt(
  template: string,
  vars: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, k) =>
    String(vars[k] ?? `{${k}}`),
  );
}

// Custom event name dispatched alongside writes so the same tab updates
// without waiting for the cross-tab `storage` event (which only fires
// when ANOTHER tab modifies localStorage).
const LANG_CHANGE_EVENT = "uzk:lang-change";

export function readLang(): Language {
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage.getItem(LANG_STORAGE_KEY);
  return stored === "lt" ? "lt" : "en";
}

export function writeLang(lang: Language): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LANG_STORAGE_KEY, lang);
  window.dispatchEvent(new CustomEvent(LANG_CHANGE_EVENT, { detail: lang }));
}

// Client-side hook. Reads the persisted language and subscribes to
// changes (same-tab via custom event, cross-tab via storage event).
import { useEffect, useState } from "react";

export function useLang(): Language {
  const [lang, setLang] = useState<Language>("en");
  useEffect(() => {
    setLang(readLang());
    const onChange = () => setLang(readLang());
    window.addEventListener(LANG_CHANGE_EVENT, onChange);
    window.addEventListener("storage", (e) => {
      if (e.key === LANG_STORAGE_KEY) onChange();
    });
    return () => {
      window.removeEventListener(LANG_CHANGE_EVENT, onChange);
    };
  }, []);
  return lang;
}
