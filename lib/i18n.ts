// EN/LT translations for every user-facing string. Admin pages stay
// English on purpose (the admin is one or two power-users; not worth
// the maintenance overhead). The voter-side surface — NameGate,
// SettingsModal, RoomGate, Standings, Leaderboard, VoteForm,
// BonusBetsForm, CountryDrawer, FloatingReactions, scoreboard pops —
// reads from t() and switches the moment the user picks a language.

export type Language = "en" | "lt";
export const LANGUAGES: Language[] = ["en", "lt"];
// Display name for each language, in its own language so the picker
// reads naturally regardless of which mode the user is currently in.
export const LANGUAGE_NAMES: Record<Language, string> = {
  en: "In English",
  lt: "Lietuviškai",
};
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
    leave_room:        "Leave room",
    link_copied:       "Link copied",
    couldnt_copy:      "Couldn't copy link",

    // RoomGate (entrance code screen)
    enter_room_code:   "Enter room code",
    enter_room:        "Enter room",
    checking:          "Checking…",
    bad_code:          "No room with that code.",
    bad_format:        "Codes are 6 characters (A–Z, 2–9).",
    reconnecting:      "Reconnecting…",

    // Standings
    no_votes_yet:      "Standings are quiet",
    no_votes_sub:      "No one has voted yet. Be the first and the leaderboard fills up live as everyone joins in.",
    be_the_first:      "Be the first",
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
    your_top_10:       "Your TOP10",
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

    // Room tab bar
    tab_home:          "Home",
    tab_chat:          "Chat",
    tab_bingo:         "Bingo",
    tab_vote:          "Vote",

    // Coming-soon placeholders
    chat_coming:       "Chat is on the way",
    chat_coming_sub:   "Live messaging with reactions, replies, and GIFs lands in a moment.",
    bingo_coming:      "Bingo card incoming",
    bingo_coming_sub:  "A 5×5 grid of Eurovision tropes. Cross them off as the night unfolds.",

    // Bonus bets — labels + descriptions
    bet_lt_placement:  "{home} placement",
    bet_lt_placement_sub:
      "Where does {home} finish? Closer guesses score more.",
    bet_wooden_spoon:  "Wooden spoon",
    bet_wooden_spoon_sub:
      "Who comes last? Even one off the bottom scores.",
    bet_lt_12_to:      "12 points from {home}",
    bet_lt_12_to_sub:
      "Which country gets {home}'s 12 points?",
    bet_big5:          "Best of the Big 5",
    bet_big5_sub:
      "UK, Germany, France, Italy or Spain — which finishes highest?",
    bet_jury_winner:   "Jury winner",
    bet_jury_winner_sub: "Country with the highest jury total.",
    bet_televote_winner: "Televote winner",
    bet_televote_winner_sub:
      "Country with the highest public televote total.",
    bet_nul:           "Zero from televote",
    bet_nul_sub:
      "Pick the countries you think get zero from the public — or 'No country' if you think no one will.",
    bet_lt_total:      "{home} total points",
    bet_lt_total_sub:
      "How many points (jury + public) does {home} end with? Closer guesses score more.",
    bet_host_top3:     "{host} top 3?",
    bet_host_top3_sub:
      "Will the host land in the top 3?",
    bet_solo_winner:   "Solo winner?",
    bet_solo_winner_sub:
      "Will the winner be a solo act?",
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
    pick_avatar:       "Pasirink veidą",
    settings:          "Nustatymai",
    language:          "Kalba",
    share_link:        "Pasidalink kambariu",
    save:              "Išsaugoti",
    cancel:            "Atšaukti",
    clear:             "Išvalyti",
    next:              "Toliau",
    back:              "Atgal",
    leave_room:        "Palikti kambarį",
    link_copied:       "Nuoroda nukopijuota",
    couldnt_copy:      "Nepavyko nukopijuoti",

    enter_room_code:   "Įvesk kambario kodą",
    enter_room:        "Įeiti",
    checking:          "Tikrinama…",
    bad_code:          "Nėra kambario tokiu kodu.",
    bad_format:        "Kodas — 6 simboliai (A–Z, 2–9).",
    reconnecting:      "Jungiamasi…",

    no_votes_yet:      "Lentelė tuščia",
    no_votes_sub:      "Niekas dar nebalsavo. Bakstelėk žemiau ir lentelė užsipildys realiu laiku, kai prisijungs kiti.",
    be_the_first:      "Būk pirmas",
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
    your_top_10:       "Tavo TOP10",
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

    tab_home:          "Pradžia",
    tab_chat:          "Pokalbiai",
    tab_bingo:         "Bingo",
    tab_vote:          "Balsuok",

    chat_coming:       "Pokalbiai jau netoli",
    chat_coming_sub:   "Realaus laiko žinutės su reakcijomis, atsakymais ir GIF-ais — tuoj tuoj.",
    bingo_coming:      "Bingo kortelė tuoj bus",
    bingo_coming_sub:  "5×5 laukelių su klasikiniais Eurovizijos štampais. Bus ką žymėti.",

    bet_lt_placement:  "{home} vieta",
    bet_lt_placement_sub:
      "Kelintoje vietoje finišuos {home}? Kuo arčiau spėjai — tuo daugiau.",
    bet_wooden_spoon:  "Paskutinė vieta",
    bet_wooden_spoon_sub:
      "Kas užims paskutinę? Net spėjus gretimą — gauni taškų.",
    bet_lt_12_to:      "12 taškų iš {home}",
    bet_lt_12_to_sub:
      "Kuriai šaliai {home} skirs savo 12 taškų?",
    bet_big5:          "Geriausias iš Big 5",
    bet_big5_sub:
      "Iš JK, Vokietijos, Prancūzijos, Italijos, Ispanijos — kas finišuos aukščiausiai?",
    bet_jury_winner:   "Žiuri nugalėtojas",
    bet_jury_winner_sub: "Šalis, kuri surinks daugiausiai žiuri taškų.",
    bet_televote_winner: "Žiūrovų nugalėtojas",
    bet_televote_winner_sub:
      "Šalis, kuri surinks daugiausiai žiūrovų taškų.",
    bet_nul:           "Nulis iš žiūrovų",
    bet_nul_sub:
      "Spėk, kurios šalys gaus nulį iš žiūrovų. Jei manai, kad visos uždirbs — rink „Nė viena“.",
    bet_lt_total:      "{home} taškai iš viso",
    bet_lt_total_sub:
      "Kiek iš viso taškų (žiuri + žiūrovai) surinks {home}? Kuo arčiau, tuo daugiau.",
    bet_host_top3:     "{host} TOP3?",
    bet_host_top3_sub:
      "Ar šeimininkai pateks į TOP3?",
    bet_solo_winner:   "Laimės solo?",
    bet_solo_winner_sub:
      "Ar laimės solinis atlikėjas (ne duetas / grupė)?",
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
  if (typeof window === "undefined") return "lt";
  const stored = window.localStorage.getItem(LANG_STORAGE_KEY);
  // LT is the default — this is a Lithuanian Eurovision party app
  // first, EN is for the international guest. Stored "en" wins; any
  // other value (including "lt" or absent) falls back to LT.
  return stored === "en" ? "en" : "lt";
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
  const [lang, setLang] = useState<Language>("lt");
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
