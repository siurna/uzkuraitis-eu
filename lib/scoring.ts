// Scoring logic for the Eurovision party prediction game.
//
// Components per voter (all summed into a single total):
//   1. Top-10 ballot vs official top-10 placements (full / half / 0).
//   2. Home country (Lithuania) placement guess.
//   3. 11 side bets covering wooden spoon, jury/televote winners,
//      nul points, yes/no toggles. See SIDE_BET_DEFS below.
//
// Half-credit on the top-10 ballot is FLOORED to integers so the leaderboard
// reads as whole numbers (12 -> 6, 7 -> 3, etc.).

export type Ballot = Record<string, string>;
export type OfficialPlacements = Record<string, number>;
export type OfficialFacts = Record<string, string>;

export const BIG_5 = ["gb", "de", "fr", "it", "es"] as const;
export const HOST_COUNTRY = "at"; // 2026 host
export const NONE_TOKEN = "NONE";  // sentinel for nul-points "no country" bet

// Eurovision points scale, matched up with placement.
export const POINTS_BY_PLACEMENT: Record<number, number> = {
  1: 12, 2: 10, 3: 8, 4: 7, 5: 6, 6: 5, 7: 4, 8: 3, 9: 2, 10: 1,
};

// ---------- top-10 ballot ----------

export function scoreTopTen(
  ballot: Ballot,
  officialPlacements: OfficialPlacements,
): number {
  const officialTop10 = new Map<string, number>();
  for (const [code, placement] of Object.entries(officialPlacements)) {
    if (placement >= 1 && placement <= 10) officialTop10.set(code, placement);
  }
  const voterPicks = new Set<string>(Object.values(ballot));

  let total = 0;
  for (const [code, officialPlacement] of officialTop10) {
    const fullPoints = POINTS_BY_PLACEMENT[officialPlacement] ?? 0;
    if (!voterPicks.has(code)) continue;

    const slotEntry = Object.entries(ballot).find(([, c]) => c === code);
    if (!slotEntry) continue;

    const voterPlacement = pointsKeyToPlacement(slotEntry[0]);
    if (voterPlacement === officialPlacement) {
      total += fullPoints;
    } else {
      // Half points, floored to integer so leaderboard stays clean.
      total += Math.floor(fullPoints / 2);
    }
  }
  return total;
}

function pointsKeyToPlacement(pointsKey: string): number {
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

// ---------- home-country (LT) placement ----------

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

// ---------- side bets ----------

// Each bet is independent: a function that turns the voter's pick + the
// official answer into points. The bet menu is data-driven so adding more
// next year is just appending to this list.
export type Bets = {
  woodenSpoon?: string | null;
  lt12To?: string | null;
  highestBig5?: string | null;
  juryWinner?: string | null;
  televoteWinner?: string | null;
  nulTelevote?: string[] | null;
  sameWinners?: boolean | null;
  hostTop3?: boolean | null;
  winnerSolo?: boolean | null;
  /** Voter's guess for the home country's final total points (0..1000). */
  ltTotalPoints?: number | null;
};

export type BetBreakdown = {
  woodenSpoon: number;
  lt12To: number;
  highestBig5: number;
  juryWinner: number;
  televoteWinner: number;
  nulTelevote: number;
  sameWinners: number;
  hostTop3: number;
  winnerSolo: number;
  ltTotalPoints: number;
};

// Per-correct-guess pts on the multi-select nul televote bet, capped at
// NUL_TELEVOTE_MAX so spamming all 35 doesn't auto-win. We also cap the
// number of guesses a voter can register on the client-side at
// NUL_TELEVOTE_MAX_PICKS so a player who picks every country can't get
// the max just by carpet-bombing — the server enforces the same cap.
export const NUL_TELEVOTE_PER_HIT = 4;
export const NUL_TELEVOTE_MAX = 12;
export const NUL_TELEVOTE_MAX_PICKS = 5;

// Helper: invert the placements map into a "by placement -> country" lookup.
function placementToCountry(placements: OfficialPlacements): Map<number, string> {
  const m = new Map<number, string>();
  for (const [code, p] of Object.entries(placements)) m.set(p, code);
  return m;
}

export function scoreBets(input: {
  bets: Bets;
  homeCountryCode: string;
  placements: OfficialPlacements;
  facts: OfficialFacts;
  totalFinalists: number;
}): BetBreakdown {
  const { bets, homeCountryCode, placements, facts, totalFinalists } = input;
  const placementByCountry = placements;
  const countryByPlacement = placementToCountry(placements);
  const homePlacement = placementByCountry[homeCountryCode] ?? null;
  const last = countryByPlacement.get(totalFinalists);

  const big5Sorted = BIG_5
    .map((c) => ({ c, p: placementByCountry[c] ?? Infinity }))
    .sort((a, b) => a.p - b.p);
  const bestBig5 = big5Sorted[0]?.p === Infinity ? null : big5Sorted[0]!.c;

  const juryWinner   = facts.jury_winner ?? null;
  const teleWinner   = facts.televote_winner ?? null;
  const nulTele      = facts.nul_televote ?? null;
  const winnerSolo   = facts.winner_solo === "true"
    ? true
    : facts.winner_solo === "false" ? false : null;

  // Wooden spoon: exact +5, off-by-1 +2, else 0.
  let woodenSpoon = 0;
  if (bets.woodenSpoon && last) {
    const lastPlacement = totalFinalists;
    const guessPlacement = placementByCountry[bets.woodenSpoon] ?? null;
    if (bets.woodenSpoon === last) woodenSpoon = 5;
    else if (guessPlacement != null && Math.abs(guessPlacement - lastPlacement) === 1) {
      woodenSpoon = 2;
    }
  }

  // LT gives its 12 to: needs the lt_12_to fact to be set. Exact +5.
  const lt12To = bets.lt12To && facts.lt_12_to && bets.lt12To === facts.lt_12_to ? 5 : 0;

  // Highest-placed Big 5 country: +3 if the voter picked it.
  const highestBig5 = bets.highestBig5 && bestBig5 && bets.highestBig5 === bestBig5 ? 3 : 0;

  // Jury / televote winners: +5 each.
  const juryW   = bets.juryWinner && juryWinner && bets.juryWinner === juryWinner ? 5 : 0;
  const teleW   = bets.televoteWinner && teleWinner && bets.televoteWinner === teleWinner ? 5 : 0;

  // Nul points televote: voter can pick multiple country guesses + the
  // NONE token. Score NUL_TELEVOTE_PER_HIT per correct guess, capped at
  // NUL_TELEVOTE_MAX so spamming the entire ballot doesn't auto-win.
  // The fact "nul_televote" itself is a CSV of country codes (or NONE).
  let nulT = 0;
  if (bets.nulTelevote && bets.nulTelevote.length > 0) {
    const truth = new Set(
      (nulTele ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    );
    if (truth.size > 0) {
      const guesses = new Set(bets.nulTelevote);
      let hits = 0;
      for (const g of guesses) if (truth.has(g)) hits++;
      nulT = Math.min(hits * NUL_TELEVOTE_PER_HIT, NUL_TELEVOTE_MAX);
    }
  }

  // Same winners (jury == televote): +2 if voter's Y/N matches the truth.
  let sameWinners = 0;
  if (bets.sameWinners != null && juryWinner && teleWinner) {
    const truth = juryWinner === teleWinner;
    if (bets.sameWinners === truth) sameWinners = 2;
  }

  // Host (Austria) top 3: +3.
  let hostTop3 = 0;
  if (bets.hostTop3 != null) {
    const hostPlacement = placementByCountry[HOST_COUNTRY] ?? null;
    if (hostPlacement != null) {
      if (bets.hostTop3 === hostPlacement <= 3) hostTop3 = 3;
    }
  }

  // Winner is a solo act: +2. Needs the winner_solo fact.
  let winnerSoloPts = 0;
  if (bets.winnerSolo != null && winnerSolo != null) {
    if (bets.winnerSolo === winnerSolo) winnerSoloPts = 2;
  }

  // LT total points: closeness-based scoring. Reads the official total
  // from facts.lt_total_points (admin enters as a number string).
  //   exact      +10
  //   off-by-5   +7
  //   off-by-15  +5
  //   off-by-30  +3
  //   off-by-60  +1
  //   beyond     +0
  let ltTotalPts = 0;
  const officialLtTotalRaw = facts.lt_total_points;
  if (
    bets.ltTotalPoints != null &&
    officialLtTotalRaw != null &&
    officialLtTotalRaw !== ""
  ) {
    const officialN = Number(officialLtTotalRaw);
    if (Number.isFinite(officialN)) {
      const diff = Math.abs(bets.ltTotalPoints - officialN);
      if (diff === 0) ltTotalPts = 10;
      else if (diff <= 5) ltTotalPts = 7;
      else if (diff <= 15) ltTotalPts = 5;
      else if (diff <= 30) ltTotalPts = 3;
      else if (diff <= 60) ltTotalPts = 1;
    }
  }

  return {
    woodenSpoon,
    lt12To,
    highestBig5,
    juryWinner: juryW,
    televoteWinner: teleW,
    nulTelevote: nulT,
    sameWinners,
    hostTop3,
    winnerSolo: winnerSoloPts,
    ltTotalPoints: ltTotalPts,
  };
}

export function totalBetPoints(b: BetBreakdown): number {
  return (
    b.woodenSpoon +
    b.lt12To +
    b.highestBig5 +
    b.juryWinner +
    b.televoteWinner +
    b.nulTelevote +
    b.sameWinners +
    b.hostTop3 +
    b.winnerSolo +
    b.ltTotalPoints
  );
}

// ---------- aggregate ----------

export function scoreVoter(input: {
  ballot: Ballot;
  homeCountryCode: string;
  homePrediction: number | null;
  bets: Bets;
  officialPlacements: OfficialPlacements;
  facts: OfficialFacts;
  totalFinalists: number;
}): {
  topTen: number;
  home: number;
  bets: BetBreakdown;
  betsTotal: number;
  total: number;
} {
  const topTen = scoreTopTen(input.ballot, input.officialPlacements);
  const home = scoreHomePrediction(
    input.homePrediction,
    input.officialPlacements[input.homeCountryCode] ?? null,
  );
  const bets = scoreBets({
    bets: input.bets,
    homeCountryCode: input.homeCountryCode,
    placements: input.officialPlacements,
    facts: input.facts,
    totalFinalists: input.totalFinalists,
  });
  const betsTotal = totalBetPoints(bets);
  return { topTen, home, bets, betsTotal, total: topTen + home + betsTotal };
}
