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

/** Visual identity that rotates with the contest year. Each
 *  Eurovision rebrands subtly (stage colours, official palette);
 *  these are the few literals that actually need to follow.
 *
 *  The abstract brand palette (fuchsia / flamingo / turquoise /
 *  yellow / blue …) is shared across years — that's the APP's
 *  identity, not the contest's annual graphics. Only the
 *  year-anchored surfaces below get themed. */
export type SeasonTheme = {
  /** html background-color. Also the colour iOS PWA paints behind a
   *  sliding-up keyboard, behind the home indicator, and in the
   *  cold-start splash frame — keeping it close to the bottom of
   *  the bloom keeps every system surface continuous with the page. */
  pageBg: string;
  /** Top-of-page radial blooms layered into html::before. Two
   *  warm/cool washes, in CSS oklch syntax (no surrounding
   *  `oklch(…)` — just the inner space-separated arguments + alpha
   *  so the CSS can wrap them with `oklch(var(--season-bloom-…))`). */
  bloom: {
    /** Upper-right warm wash. */
    warm: string;
    /** Upper-left cool wash. */
    cool: string;
  };
  /** Hex passed to manifest.theme_color + <meta name="theme-color">.
   *  Drives iOS status bar tint and PWA chrome. Usually equal to
   *  `pageBg`. */
  themeColor: string;
};

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
  /** Visual identity for this season (palette + chrome). */
  theme: SeasonTheme;
};
