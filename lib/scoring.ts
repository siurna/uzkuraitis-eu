// Scoring logic for the Eurovision party prediction game.
//
// Two independent components per voter:
//
// 1. Top-10 ballot vs official top-10 placements:
//      country in your slot && official top-10 == that placement → full ESC pts
//      country anywhere in your top 10 but wrong slot              → half pts
//      country not in your top 10                                  → 0
//
// 2. Home country (e.g. Lithuania) placement guess:
//      exact                = 10
//      off-by-1             = 7
//      off-by-2             = 5
//      off-by-3..5          = 3
//      off-by-6..10         = 1
//      off-by-11+           = 0
//
// Total score is the sum.

// Map from points-slot (12, 10, 8...) to a country code, as stored in the
// voter's ballot (Record<string, string>).
export type Ballot = Record<string, string>;

// Map from country code to its official final placement (1, 2, 3...).
export type OfficialPlacements = Record<string, number>;

// Eurovision points scale, matched up with placement. Position 1 in the
// official top 10 awards 12, position 2 awards 10, position 3 awards 8, etc.
export const POINTS_BY_PLACEMENT: Record<number, number> = {
  1: 12,
  2: 10,
  3: 8,
  4: 7,
  5: 6,
  6: 5,
  7: 4,
  8: 3,
  9: 2,
  10: 1,
};

// Sum the voter's score for the top-10 ballot portion.
export function scoreTopTen(
  ballot: Ballot,
  officialPlacements: OfficialPlacements,
): number {
  // Build official top-10: { countryCode: placement } for placements 1..10.
  const officialTop10 = new Map<string, number>();
  for (const [code, placement] of Object.entries(officialPlacements)) {
    if (placement >= 1 && placement <= 10) officialTop10.set(code, placement);
  }

  // Pull the voter's chosen countries into a quick lookup.
  const voterPicks = new Set<string>(Object.values(ballot));

  let total = 0;
  for (const [code, officialPlacement] of officialTop10) {
    const fullPoints = POINTS_BY_PLACEMENT[officialPlacement] ?? 0;
    if (!voterPicks.has(code)) {
      // not in voter's top 10 → 0
      continue;
    }
    // Find which slot the voter put this country in.
    const voterSlotEntry = Object.entries(ballot).find(([, c]) => c === code);
    if (!voterSlotEntry) continue;
    const voterPlacement = mapBallotKeyToPlacement(voterSlotEntry[0]);
    if (voterPlacement === officialPlacement) {
      total += fullPoints;
    } else {
      // Half points (Eurovision points are even or 1, halving sometimes
      // produces .5 — we keep the float and let the leaderboard format).
      total += fullPoints / 2;
    }
  }
  return total;
}

// The voter's ballot is keyed by the points value (string). Translate that
// back to a placement (12 pts → 1st, 10 pts → 2nd, ...).
function mapBallotKeyToPlacement(pointsKey: string): number {
  const pts = Number(pointsKey);
  switch (pts) {
    case 12: return 1;
    case 10: return 2;
    case 8:  return 3;
    case 7:  return 4;
    case 6:  return 5;
    case 5:  return 6;
    case 4:  return 7;
    case 3:  return 8;
    case 2:  return 9;
    case 1:  return 10;
    default: return -1;
  }
}

// Score the home-country placement guess against the official result.
// Returns 0 if either input is missing.
export function scoreHomePrediction(
  prediction: number | null | undefined,
  officialPlacement: number | null | undefined,
): number {
  if (
    prediction == null ||
    officialPlacement == null ||
    !Number.isFinite(prediction) ||
    !Number.isFinite(officialPlacement)
  ) {
    return 0;
  }
  const diff = Math.abs(prediction - officialPlacement);
  if (diff === 0) return 10;
  if (diff === 1) return 7;
  if (diff === 2) return 5;
  if (diff <= 5) return 3;
  if (diff <= 10) return 1;
  return 0;
}

// Sum-of-parts score for a single voter.
export function scoreVoter(input: {
  ballot: Ballot;
  homeCountryCode: string;
  homePrediction: number | null;
  officialPlacements: OfficialPlacements;
}): {
  topTen: number;
  home: number;
  total: number;
} {
  const topTen = scoreTopTen(input.ballot, input.officialPlacements);
  const home = scoreHomePrediction(
    input.homePrediction,
    input.officialPlacements[input.homeCountryCode] ?? null,
  );
  return { topTen, home, total: topTen + home };
}
