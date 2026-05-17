// Country types + universal helpers. The actual finalist lineup (artist,
// song, running order, host country) lives per-year in
// `lib/seasons/<year>.ts` and is exposed here as a thin facade pointing
// at the CURRENT season — so existing call sites (`import { countries }
// from "@/lib/countries"`) keep working unchanged. Code that needs a
// SPECIFIC season's data — e.g. an admin viewing 2025 results next year
// — should call `getSeason(year).countries` directly.
//
// COUNTRY_NAMES_LT is universal across all years (Lithuanian names of
// every European country) and stays here.

import { CURRENT_SEASON } from "@/lib/seasons";

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
// alpha-2 lowercase. Universal across seasons — populated with every
// country that has ever competed so a season's roster can pull the LT
// name without re-typing it each year.
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

// The CURRENT season's lineup. Most call sites don't care which year
// they're rendering — they want "this year's roster" and the answer
// is wherever `CURRENT_SEASON_YEAR` points (lib/seasons/index.ts).
export const countries: Country[] = CURRENT_SEASON.countries;

export const countriesByCode: Record<string, Country> = Object.fromEntries(
  countries.map((c) => [c.code, c]),
);

export function getCountry(code: string): Country | undefined {
  return countriesByCode[code];
}
