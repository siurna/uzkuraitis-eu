// Scoring logic for the Eurovision party prediction game.
//
// Components per voter (all summed into a single total):
//   1. Top-10 ballot vs official top-10 placements ("notch-down" — see below).
//   2. Home country (Lithuania) placement guess.
//   3. 11 side bets covering wooden spoon, jury/televote winners,
//      nul points, yes/no toggles. See SIDE_BET_DEFS below.
//
// Top-10 ballot — "notch-down": a country only scores if it actually
// finished in the official top 10. You then earn the Eurovision value of
// the spot that's `|yourPlace − realPlace|` notches *below* its real
// finish — i.e. exact = full value, every place you're off slides one rung
// down the 12/10/8/7…1 ladder, and anything past 10th rungs out to 0.

export type Ballot = Record<string, string>;
export type OfficialPlacements = Record<string, number>;
export type OfficialFacts = Record<string, string>;

export const BIG_5 = ["gb", "de", "fr", "it", "es"] as const;
export const HOST_COUNTRY = "at"; // 2026 host
export const NONE_TOKEN = "NONE";  // sentinel for nul-points "no country" bet

// "Chat highlights" bonus: a small social kicker layered on top of the
// contest score. A message with ≥ HIGHLIGHT_THRESHOLD reactions is a
// highlight; each one a voter authored is worth HIGHLIGHT_POINTS_PER,
// capped per voter at HIGHLIGHT_POINTS_MAX. Lives here so leaderboard.ts
// and the profile route share one source.
export const HIGHLIGHT_THRESHOLD = 5;
export const HIGHLIGHT_POINTS_PER = 2;
export const HIGHLIGHT_POINTS_MAX = 12;

// Eurovision points scale, matched up with placement.
export const POINTS_BY_PLACEMENT: Record<number, number> = {
  1: 12, 2: 10, 3: 8, 4: 7, 5: 6, 6: 5, 7: 4, 8: 3, 9: 2, 10: 1,
};

// Per-room precomputed scoring context. Building these maps is
// O(N) over `placements` / `facts`; doing it once per voter when a
// 50-person room scores is wasteful. Build once in the room scope,
// pass through to scoreVoter.
export type ScoringContext = {
  /** code → placement, for the top 10 only. */
  officialTop10: Map<string, number>;
  /** placement → code, for fast inverse lookups. */
  placementToCountry: Map<number, string>;
  /** wooden-spoon country code, if any (fact OR last-placement fallback). */
  last: string | null;
  /** highest-finishing Big-5 country, if any. */
  bestBig5: string | null;
  /** parsed jury_winner / televote_winner / winner_solo / nul_televote. */
  juryWinner: string | null;
  teleWinner: string | null;
  winnerSolo: boolean | null;
  /** parsed nul-televote truth set (split on commas). */
  nulTrueSet: Set<string>;
  /** Pre-resolved home placement (fact > placements lookup). */
  officialHomePlacement: number | null;
  /** Cached lt_total_points truth as a number, or null. */
  ltTotalTruth: number | null;
  /** Cached lt_jury_count truth as a number, or null. */
  ltJuryCountTruth: number | null;
};

export function precomputeScoringContext(
  placements: OfficialPlacements,
  facts: OfficialFacts,
  totalFinalists: number,
  homeCountryCode: string,
): ScoringContext {
  const officialTop10 = new Map<string, number>();
  const placementToCountryMap = new Map<number, string>();
  for (const [code, p] of Object.entries(placements)) {
    placementToCountryMap.set(p, code);
    if (p >= 1 && p <= 10) officialTop10.set(code, p);
  }

  const last =
    facts.wooden_spoon_country ??
    placementToCountryMap.get(totalFinalists) ??
    null;

  const big5Sorted = BIG_5
    .map((c) => ({ c, p: placements[c] ?? Infinity }))
    .sort((a, b) => a.p - b.p);
  const bestBig5 =
    big5Sorted[0]?.p === Infinity ? null : big5Sorted[0]!.c;

  const winnerSolo =
    facts.winner_solo === "true"
      ? true
      : facts.winner_solo === "false"
        ? false
        : null;

  const nulTrueSet = new Set(
    (facts.nul_televote ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );

  const homePlacementRaw = facts.home_country_placement;
  const homePlacementFact =
    homePlacementRaw != null && homePlacementRaw !== ""
      ? Number(homePlacementRaw)
      : null;
  const officialHomePlacement =
    homePlacementFact != null && Number.isFinite(homePlacementFact)
      ? homePlacementFact
      : placements[homeCountryCode] ?? null;

  const ltTotalRaw = facts.lt_total_points;
  const ltTotalNum = ltTotalRaw != null && ltTotalRaw !== "" ? Number(ltTotalRaw) : null;
  const ltTotalTruth = Number.isFinite(ltTotalNum) ? ltTotalNum : null;

  const ltJuryCountRaw = facts.lt_jury_count;
  const ltJuryCountNum =
    ltJuryCountRaw != null && ltJuryCountRaw !== "" ? Number(ltJuryCountRaw) : null;
  const ltJuryCountTruth = Number.isFinite(ltJuryCountNum) ? ltJuryCountNum : null;

  return {
    officialTop10,
    placementToCountry: placementToCountryMap,
    last,
    bestBig5,
    juryWinner: facts.jury_winner ?? null,
    teleWinner: facts.televote_winner ?? null,
    winnerSolo,
    nulTrueSet,
    officialHomePlacement,
    ltTotalTruth,
    ltJuryCountTruth,
  };
}

// ---------- top-10 ballot ----------

// Internal scorer that takes the precomputed `officialTop10`. The
// public `scoreTopTen` below wraps it for callers that don't have
// a context yet (single-voter use cases like the profile route).
function scoreTopTenWithCtx(
  ballot: Ballot,
  officialTop10: Map<string, number>,
): number {
  const voterPicks = new Set<string>(Object.values(ballot));
  let total = 0;
  for (const [code, officialPlacement] of officialTop10) {
    if (!voterPicks.has(code)) continue;
    const slotEntry = Object.entries(ballot).find(([, c]) => c === code);
    if (!slotEntry) continue;
    const voterPlacement = pointsKeyToPlacement(slotEntry[0]);
    if (voterPlacement < 1) continue;
    // Notch-down: score the value of the spot `distance` rungs below the
    // country's real finish. Exact → full value; past 10th → 0.
    const distance = Math.abs(voterPlacement - officialPlacement);
    total += POINTS_BY_PLACEMENT[officialPlacement + distance] ?? 0;
  }
  return total;
}

export function scoreTopTen(
  ballot: Ballot,
  officialPlacements: OfficialPlacements,
): number {
  const officialTop10 = new Map<string, number>();
  for (const [code, placement] of Object.entries(officialPlacements)) {
    if (placement >= 1 && placement <= 10) officialTop10.set(code, placement);
  }
  return scoreTopTenWithCtx(ballot, officialTop10);
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

// Per-pick breakdown of a TOP-10 ballot. Same scoring rule as
// `scoreTopTen`, but returns one row per slot so a UI can show
// "you picked SE for 12, it finished 2nd, you scored 10".
export type TopTenPickBreakdown = {
  /** The ballot slot value (12, 10, 8 … 1). */
  points: number;
  /** ISO-2 lowercase, or empty string if the slot is empty. */
  countryCode: string;
  /** Official Eurovision placement (1..N) or null if the country wasn't
   *  in the official table or this slot is empty. */
  officialPlacement: number | null;
  /** Points earned for this slot under the notch-down rule. */
  earned: number;
};

const TOP_TEN_POINT_SLOTS = [12, 10, 8, 7, 6, 5, 4, 3, 2, 1] as const;

export function scoreTopTenBreakdown(
  ballot: Ballot,
  officialPlacements: OfficialPlacements,
): TopTenPickBreakdown[] {
  return TOP_TEN_POINT_SLOTS.map((p) => {
    const code = ballot[String(p)] ?? "";
    const officialPlacement = code ? officialPlacements[code] ?? null : null;
    let earned = 0;
    if (
      code &&
      officialPlacement != null &&
      officialPlacement >= 1 &&
      officialPlacement <= 10
    ) {
      const voterPlacement = pointsKeyToPlacement(String(p));
      if (voterPlacement >= 1) {
        const distance = Math.abs(voterPlacement - officialPlacement);
        earned = POINTS_BY_PLACEMENT[officialPlacement + distance] ?? 0;
      }
    }
    return { points: p, countryCode: code, officialPlacement, earned };
  });
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
  // Same "notch-down the Eurovision ladder" idea as the TOP10 ballot, but
  // always starting from the top rung: nail the placement → 12, then one
  // rung lower (12 → 10 → 8 → 7 … 1) per place you're off; >9 off → 0.
  const diff = Math.abs(prediction - officialPlacement);
  return POINTS_BY_PLACEMENT[1 + diff] ?? 0;
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
  hostTop3?: boolean | null;
  winnerSolo?: boolean | null;
  /** Voter's guess for the home country's final total points (0..1000). */
  ltTotalPoints?: number | null;
  /** Voter's guess for how many voting countries gave the home country
   *  any jury points (the "long voting part" count, 0..~40). Scored on
   *  closeness. */
  ltJuryCount?: number | null;
};

export type BetBreakdown = {
  woodenSpoon: number;
  lt12To: number;
  highestBig5: number;
  juryWinner: number;
  televoteWinner: number;
  nulTelevote: number;
  hostTop3: number;
  winnerSolo: number;
  ltTotalPoints: number;
  ltJuryCount: number;
};

// Per-correct-guess pts on the multi-select nul televote bet, capped at
// NUL_TELEVOTE_MAX so spamming all 35 doesn't auto-win. We also cap the
// number of guesses a voter can register on the client-side at
// NUL_TELEVOTE_MAX_PICKS so a player who picks every country can't get
// the max just by carpet-bombing — the server enforces the same cap.
export const NUL_TELEVOTE_PER_HIT = 3;
export const NUL_TELEVOTE_MAX = 12;
export const NUL_TELEVOTE_MAX_PICKS = 5;

// Internal scorer that consumes a precomputed `ScoringContext` so a
// loop over many voters doesn't rebuild placementToCountry / bestBig5
// / nulTrueSet on every iteration. The public `scoreBets` wraps it
// for single-voter use cases.
function scoreBetsWithCtx(input: {
  bets: Bets;
  homeCountryCode: string;
  placements: OfficialPlacements;
  facts: OfficialFacts;
  totalFinalists: number;
  ctx: ScoringContext;
}): BetBreakdown {
  const { bets, placements, facts, totalFinalists, ctx } = input;
  const {
    last,
    bestBig5,
    juryWinner,
    teleWinner,
    winnerSolo,
    nulTrueSet,
    ltTotalTruth,
    ltJuryCountTruth,
  } = ctx;

  // Wooden spoon: exact +5, off-by-1 +2 (only useful when last is in
  // the placement table), else 0.
  let woodenSpoon = 0;
  if (bets.woodenSpoon && last) {
    const lastPlacement = totalFinalists;
    const guessPlacement = placements[bets.woodenSpoon] ?? null;
    if (bets.woodenSpoon === last) woodenSpoon = 5;
    else if (guessPlacement != null && Math.abs(guessPlacement - lastPlacement) === 1) {
      woodenSpoon = 2;
    }
  }

  // LT gives its 12 to: needs the lt_12_to fact to be set. Exact +5.
  const lt12To = bets.lt12To && facts.lt_12_to && bets.lt12To === facts.lt_12_to ? 5 : 0;

  // Highest-placed Big 5 country: +3 if the voter picked it exactly,
  // +1 if their pick finished within 2 placement spots of the actual
  // best Big 5 (consolation for "you bet on the right band of the
  // scoreboard, just the wrong country"). Same closeness shape as the
  // wooden-spoon off-by-one rule.
  let highestBig5 = 0;
  if (bets.highestBig5 && bestBig5) {
    if (bets.highestBig5 === bestBig5) {
      highestBig5 = 3;
    } else {
      const guessP = placements[bets.highestBig5] ?? null;
      const truthP = placements[bestBig5] ?? null;
      if (guessP != null && truthP != null && Math.abs(guessP - truthP) <= 2) {
        highestBig5 = 1;
      }
    }
  }

  // Jury / televote winners: +5 each.
  const juryW   = bets.juryWinner && juryWinner && bets.juryWinner === juryWinner ? 5 : 0;
  const teleW   = bets.televoteWinner && teleWinner && bets.televoteWinner === teleWinner ? 5 : 0;

  // Nul points televote: voter can pick multiple country guesses + the
  // NONE token. Score NUL_TELEVOTE_PER_HIT per correct guess, capped at
  // NUL_TELEVOTE_MAX so spamming the entire ballot doesn't auto-win.
  let nulT = 0;
  if (bets.nulTelevote && bets.nulTelevote.length > 0 && nulTrueSet.size > 0) {
    const guesses = new Set(bets.nulTelevote);
    let hits = 0;
    for (const g of guesses) if (nulTrueSet.has(g)) hits++;
    nulT = Math.min(hits * NUL_TELEVOTE_PER_HIT, NUL_TELEVOTE_MAX);
  }

  // Host (Austria) top-3: +3 if the voter's yes/no matches the
  // host's actual top-3 status. Only counts when we can resolve the
  // host's placement.
  let hostT3 = 0;
  if (bets.hostTop3 != null) {
    const hostPlacement = placements[HOST_COUNTRY] ?? null;
    if (hostPlacement != null) {
      if (bets.hostTop3 === (hostPlacement <= 3)) hostT3 = 3;
    }
  }

  // Winner solo (vs group): +2 when the voter's yes/no matches the
  // winner_solo fact. Same rule the original scorer used.
  const winnerS =
    bets.winnerSolo != null && winnerSolo != null && bets.winnerSolo === winnerSolo ? 2 : 0;

  // LT total points: closeness-graded, five tiers.
  //   exact      +10
  //   off-by-5   +7
  //   off-by-15  +5
  //   off-by-30  +3
  //   off-by-60  +1
  //   beyond     +0
  let ltTotal = 0;
  if (bets.ltTotalPoints != null && ltTotalTruth != null) {
    const diff = Math.abs(bets.ltTotalPoints - ltTotalTruth);
    if (diff === 0) ltTotal = 10;
    else if (diff <= 5) ltTotal = 7;
    else if (diff <= 15) ltTotal = 5;
    else if (diff <= 30) ltTotal = 3;
    else if (diff <= 60) ltTotal = 1;
  }

  // LT jury count: how many voting countries gave LT any jury points
  // during the long jury reveal. Tight closeness ladder because the
  // range is small (0..~40):
  //   exact   +5
  //   ±1      +3
  //   ±3      +2
  //   ±5      +1
  //   beyond  +0
  let ltJuryC = 0;
  if (bets.ltJuryCount != null && ltJuryCountTruth != null) {
    const diff = Math.abs(bets.ltJuryCount - ltJuryCountTruth);
    if (diff === 0) ltJuryC = 5;
    else if (diff <= 1) ltJuryC = 3;
    else if (diff <= 3) ltJuryC = 2;
    else if (diff <= 5) ltJuryC = 1;
  }

  return {
    woodenSpoon,
    lt12To,
    highestBig5,
    juryWinner: juryW,
    televoteWinner: teleW,
    nulTelevote: nulT,
    hostTop3: hostT3,
    winnerSolo: winnerS,
    ltTotalPoints: ltTotal,
    ltJuryCount: ltJuryC,
  };
}

export function scoreBets(input: {
  bets: Bets;
  homeCountryCode: string;
  placements: OfficialPlacements;
  facts: OfficialFacts;
  totalFinalists: number;
}): BetBreakdown {
  const ctx = precomputeScoringContext(
    input.placements,
    input.facts,
    input.totalFinalists,
    input.homeCountryCode,
  );
  return scoreBetsWithCtx({ ...input, ctx });
}

export function totalBetPoints(b: BetBreakdown): number {
  return (
    b.woodenSpoon +
    b.lt12To +
    b.highestBig5 +
    b.juryWinner +
    b.televoteWinner +
    b.nulTelevote +
    b.hostTop3 +
    b.winnerSolo +
    b.ltTotalPoints +
    b.ltJuryCount
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
  /** Optional precomputed context. When supplied, the per-voter
   *  loop avoids rebuilding placementToCountry / bestBig5 /
   *  nulTrueSet / officialTop10 for every voter — caller hoists the
   *  computation out of the loop instead. Single-voter use cases
   *  (the profile route) can omit this and accept the small extra
   *  cost. */
  ctx?: ScoringContext;
}): {
  topTen: number;
  home: number;
  bets: BetBreakdown;
  betsTotal: number;
  total: number;
} {
  const ctx =
    input.ctx ??
    precomputeScoringContext(
      input.officialPlacements,
      input.facts,
      input.totalFinalists,
      input.homeCountryCode,
    );
  const topTen = scoreTopTenWithCtx(input.ballot, ctx.officialTop10);
  const home = scoreHomePrediction(input.homePrediction, ctx.officialHomePlacement);
  const bets = scoreBetsWithCtx({
    bets: input.bets,
    homeCountryCode: input.homeCountryCode,
    placements: input.officialPlacements,
    facts: input.facts,
    totalFinalists: input.totalFinalists,
    ctx,
  });
  const betsTotal = totalBetPoints(bets);
  return { topTen, home, bets, betsTotal, total: topTen + home + betsTotal };
}
