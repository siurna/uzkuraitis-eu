// Eurovision 2026 — Vienna lineup (35 participants).
//
// Sources (last cross-referenced 2026-05-09):
//   - https://www.eurovision.com/eurovision-song-contest/vienna-2026/all-participants/
//   - https://eurovisionworld.com/eurovision/2026
//
// VERIFY BEFORE LAUNCH: artist/song names below were collected from web
// search aggregators because the official site is JS-rendered. Treat as
// best-effort; correct any errors directly here. The `code` (ISO 3166-1
// alpha-2 lowercase) and `flag` emoji are authoritative — those drive the
// scoring tables and SVG asset lookup.

export type Country = {
  code: string;
  name: string;
  /** Lithuanian translation. Used in the LT-mode UI; falls back to
   *  `name` when missing. */
  nameLt?: string;
  flag: string;
  artist: string;
  song: string;
  /** Running-order position in the grand final, if known. Used as a tiebreaker. */
  order: number;
};

// Lookup table for localised country names. Keyed on ISO 3166-1
// alpha-2 lowercase.
export const COUNTRY_NAMES_LT: Record<string, string> = {
  al: "Albanija",
  am: "Armėnija",
  au: "Australija",
  at: "Austrija",
  az: "Azerbaidžanas",
  be: "Belgija",
  bg: "Bulgarija",
  hr: "Kroatija",
  cy: "Kipras",
  cz: "Čekija",
  dk: "Danija",
  ee: "Estija",
  fi: "Suomija",
  fr: "Prancūzija",
  ge: "Sakartvelas",
  de: "Vokietija",
  gr: "Graikija",
  il: "Izraelis",
  it: "Italija",
  lv: "Latvija",
  lt: "Lietuva",
  lu: "Liuksemburgas",
  mt: "Malta",
  md: "Moldova",
  me: "Juodkalnija",
  no: "Norvegija",
  pl: "Lenkija",
  pt: "Portugalija",
  ro: "Rumunija",
  sm: "San Marinas",
  rs: "Serbija",
  se: "Švedija",
  ch: "Šveicarija",
  ua: "Ukraina",
  gb: "Jungtinė Karalystė",
  // Big-5 / non-finalist helpers — used by bonus-bet copy.
  es: "Ispanija",
  nl: "Nyderlandai",
  ie: "Airija",
  is: "Islandija",
};

// Localised country-name lookup. Falls back to the English `name` if
// the LT translation is missing.
export function countryName(code: string, lang: "en" | "lt"): string {
  const c = countries.find((x) => x.code === code);
  if (lang === "lt") {
    return COUNTRY_NAMES_LT[code] ?? c?.name ?? code.toUpperCase();
  }
  return c?.name ?? code.toUpperCase();
}

export const countries: Country[] = [
  { code: "dk", name: "Denmark",        flag: "🇩🇰", artist: "Søren Torpegaard Lund",                 song: "Før Vi Går Hjem",      order: 1  },
  { code: "de", name: "Germany",        flag: "🇩🇪", artist: "Sarah Engels",                          song: "Fire",                 order: 2  },
  { code: "il", name: "Israel",         flag: "🇮🇱", artist: "Noam Bettan",                           song: "Michelle",             order: 3  },
  { code: "be", name: "Belgium",        flag: "🇧🇪", artist: "ESSYLA",                                song: "Dancing on the Ice",   order: 4  },
  { code: "al", name: "Albania",        flag: "🇦🇱", artist: "Alis",                                  song: "Nân",                  order: 5  },
  { code: "gr", name: "Greece",         flag: "🇬🇷", artist: "Akylas",                                song: "Ferto",                order: 6  },
  { code: "ua", name: "Ukraine",        flag: "🇺🇦", artist: "LELÉKA",                                song: "Ridnym",               order: 7  },
  { code: "au", name: "Australia",      flag: "🇦🇺", artist: "Delta Goodrem",                         song: "Eclipse",              order: 8  },
  { code: "rs", name: "Serbia",         flag: "🇷🇸", artist: "LAVINA",                                song: "Kraj Mene",            order: 9  },
  { code: "mt", name: "Malta",          flag: "🇲🇹", artist: "AIDAN",                                 song: "Bella",                order: 10 },
  { code: "cz", name: "Czechia",        flag: "🇨🇿", artist: "Daniel Zizka",                          song: "CROSSROADS",           order: 11 },
  { code: "bg", name: "Bulgaria",       flag: "🇧🇬", artist: "DARA",                                  song: "Bangaranga",           order: 12 },
  { code: "hr", name: "Croatia",        flag: "🇭🇷", artist: "LELEK",                                 song: "Andromeda",            order: 13 },
  { code: "gb", name: "United Kingdom", flag: "🇬🇧", artist: "LOOK MUM NO COMPUTER",                  song: "Eins, Zwei, Drei",    order: 14 },
  { code: "fr", name: "France",         flag: "🇫🇷", artist: "Monroe",                                song: "Regarde !",            order: 15 },
  { code: "md", name: "Moldova",        flag: "🇲🇩", artist: "Satoshi",                               song: "Viva, Moldova!",       order: 16 },
  { code: "fi", name: "Finland",        flag: "🇫🇮", artist: "Linda Lampenius x Pete Parkkonen",      song: "Liekinheitin",         order: 17 },
  { code: "pl", name: "Poland",         flag: "🇵🇱", artist: "ALICJA",                                song: "Pray",                 order: 18 },
  { code: "lt", name: "Lithuania",      flag: "🇱🇹", artist: "Lion Ceccah",                           song: "Sólo Quiero Más",      order: 19 },
  { code: "se", name: "Sweden",         flag: "🇸🇪", artist: "FELICIA",                               song: "My System",            order: 20 },
  { code: "cy", name: "Cyprus",         flag: "🇨🇾", artist: "Antigoni",                              song: "JALLA",                order: 21 },
  { code: "it", name: "Italy",          flag: "🇮🇹", artist: "Sal Da Vinci",                          song: "Per Sempre Sì",        order: 22 },
  { code: "no", name: "Norway",         flag: "🇳🇴", artist: "JONAS LOVV",                            song: "YA YA YA",             order: 23 },
  { code: "ro", name: "Romania",        flag: "🇷🇴", artist: "Alexandra Căpitănescu",                 song: "Choke Me",             order: 24 },
  { code: "at", name: "Austria",        flag: "🇦🇹", artist: "COSMÓ",                                 song: "Tanzschein",           order: 25 },
];

export const countriesByCode: Record<string, Country> = Object.fromEntries(
  countries.map((c) => [c.code, c]),
);

export function getCountry(code: string): Country | undefined {
  return countriesByCode[code];
}
