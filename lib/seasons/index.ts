// Season registry + lookup. Add a new year by:
//   1. dropping a `lib/seasons/<year>.ts` modelled on `2026.ts`
//   2. importing + adding it to `SEASONS` below
//   3. bumping `CURRENT_SEASON_YEAR` if it's now the live show
//
// Code that needs season-keyed data calls `getSeason(year)` — the
// `year` is on every `rooms` row, so any room-scoped flow has it.
// Code that doesn't have a room context yet (the join gate, admin
// "create room" form, OG images for shareable URLs that aren't
// room-specific) reads `CURRENT_SEASON`.

import { SEASON_2026 } from "./2026";
import type { Season } from "./types";

export const SEASONS = {
  2026: SEASON_2026,
} as const satisfies Record<number, Season>;

export type SeasonYear = keyof typeof SEASONS;

/** The year the app is "primarily" running for — used when no room
 *  context is available, and as the default for new rooms. Bump it
 *  the moment you flip the show over to a new year. */
export const CURRENT_SEASON_YEAR: SeasonYear = 2026;
export const CURRENT_SEASON: Season = SEASONS[CURRENT_SEASON_YEAR];

/** All registered season years, sorted newest first. Drives the
 *  admin "year" filter dropdown. */
export const ALL_SEASON_YEARS: SeasonYear[] = (
  Object.keys(SEASONS).map((y) => Number(y) as SeasonYear)
).sort((a, b) => b - a);

/** Look up a season by its year. Falls back to `CURRENT_SEASON`
 *  for unknown years (e.g. a stale `rooms.year` column from a
 *  retired season whose file has been deleted) so callers don't
 *  have to handle null. */
export function getSeason(year: number | null | undefined): Season {
  if (year == null) return CURRENT_SEASON;
  return (SEASONS as Record<number, Season>)[year] ?? CURRENT_SEASON;
}

export type { Season } from "./types";
