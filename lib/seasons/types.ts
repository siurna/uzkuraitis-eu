// Season-keyed data for the contest. One file per year; everything
// that changes annually (finalists list, host country, Big-5
// composition, wordmark) lives in here. Code that operates over
// season-aware data reads from `getSeason(year)` — viewer-side via
// the current room's `year`, admin-side via the selected season in
// the picker.
//
// Evergreen things (bingo tropes that aren't year-specific,
// scoring formulas, bonus-bet types) stay in their original files.
// Only what actually rotates annually is forked here.

import type { Country } from "@/lib/countries";

export type Season = {
  /** Calendar year of the contest. Used as the primary key. */
  year: number;
  /** ISO-2 code of the host country (the previous year's winner). */
  hostCountry: string;
  /** Host city, both languages — surfaces in the presence bar /
   *  brand copy / OG share image / Logo wordmark caption. */
  hostCity: { en: string; lt: string };
  /** This year's grand-final lineup, in running-order. */
  countries: Country[];
  /** Auto-qualifying "Big" set. 2026 dropped to 4 because Spain
   *  withdrew. Used by the highest-Big-5 bonus-bet ladder. */
  big5: readonly string[];
};
