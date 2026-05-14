"use client";

import { HeartFlag } from "@/components/flag";
import { countryName, getCountry } from "@/lib/countries";
import {
  BIG_5,
  HOST_COUNTRY,
  NONE_TOKEN,
  type Bets,
  type BetBreakdown,
  type OfficialFacts,
  type OfficialPlacements,
} from "@/lib/scoring";
import { t, type Language } from "@/lib/i18n";

// "You said / it was" scorecard for the BONUS bets, parallel to
// BallotComparison (which handles the TOP10 ballot). Reads the
// voter's `betPicks` and the room's `facts` / `placements` and
// renders one row per bet the voter put down. Skipped bets stay
// hidden — a row only shows up if the voter actually placed it.
//
// Mounted on the MyResults home card and inside the full Results
// tab.
export function BetsComparison({
  picks,
  earned,
  facts,
  placements,
  homeCountryCode,
  lang,
  totalFinalists,
}: {
  picks: Bets;
  earned: BetBreakdown;
  facts: OfficialFacts;
  placements: OfficialPlacements;
  homeCountryCode: string;
  lang: Language;
  totalFinalists: number;
}) {
  const placementToCountry = new Map<number, string>();
  for (const [c, p] of Object.entries(placements)) placementToCountry.set(p, c);

  const last = placementToCountry.get(totalFinalists) ?? null;
  const bestBig5 =
    BIG_5
      .map((c) => ({ c, p: placements[c] ?? Infinity }))
      .sort((a, b) => a.p - b.p)[0]?.p === Infinity
      ? null
      : BIG_5
          .map((c) => ({ c, p: placements[c] ?? Infinity }))
          .sort((a, b) => a.p - b.p)[0]!.c;
  const hostPlacement = placements[HOST_COUNTRY] ?? null;
  const hostInTop3 =
    hostPlacement != null ? hostPlacement <= 3 : null;
  const winnerSolo =
    facts.winner_solo === "true"
      ? true
      : facts.winner_solo === "false"
        ? false
        : null;
  const nulTrue = (facts.nul_televote ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const rows: Row[] = [];

  if (picks.woodenSpoon) {
    rows.push({
      kind: "country",
      key: "wooden",
      label: t(lang, "bet_wooden_spoon"),
      you: picks.woodenSpoon,
      truth: last,
      earned: earned.woodenSpoon,
    });
  }
  if (picks.lt12To) {
    rows.push({
      kind: "country",
      key: "lt12to",
      label: t(lang, "bet_lt_12_to"),
      you: picks.lt12To,
      truth: facts.lt_12_to ?? null,
      earned: earned.lt12To,
    });
  }
  if (picks.highestBig5) {
    rows.push({
      kind: "country",
      key: "big5",
      label: t(lang, "bet_big5"),
      you: picks.highestBig5,
      truth: bestBig5,
      earned: earned.highestBig5,
    });
  }
  if (picks.juryWinner) {
    rows.push({
      kind: "country",
      key: "jury",
      label: t(lang, "bet_jury_winner"),
      you: picks.juryWinner,
      truth: facts.jury_winner ?? null,
      earned: earned.juryWinner,
    });
  }
  if (picks.televoteWinner) {
    rows.push({
      kind: "country",
      key: "tele",
      label: t(lang, "bet_televote_winner"),
      you: picks.televoteWinner,
      truth: facts.televote_winner ?? null,
      earned: earned.televoteWinner,
    });
  }
  if (picks.nulTelevote && picks.nulTelevote.length > 0) {
    rows.push({
      kind: "nul",
      key: "nul",
      label: t(lang, "bet_nul"),
      you: picks.nulTelevote,
      truth: nulTrue,
      earned: earned.nulTelevote,
    });
  }
  if (picks.hostTop3 != null) {
    rows.push({
      kind: "bool",
      key: "host3",
      label: t(lang, "bet_host_top3").replace(
        "{host}",
        countryName(HOST_COUNTRY, lang),
      ),
      you: picks.hostTop3,
      truth: hostInTop3,
      earned: earned.hostTop3,
    });
  }
  if (picks.winnerSolo != null) {
    rows.push({
      kind: "bool",
      key: "solo",
      label: t(lang, "bet_solo_winner"),
      you: picks.winnerSolo,
      truth: winnerSolo,
      earned: earned.winnerSolo,
    });
  }
  if (picks.ltTotalPoints != null) {
    const truthN = facts.lt_total_points ? Number(facts.lt_total_points) : null;
    rows.push({
      kind: "number",
      key: "ltpts",
      label: t(lang, "bet_lt_total").replace(
        "{home}",
        countryName(homeCountryCode, lang),
      ),
      you: picks.ltTotalPoints,
      truth: Number.isFinite(truthN) ? truthN : null,
      earned: earned.ltTotalPoints,
    });
  }

  if (rows.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-[11px] uppercase tracking-[0.2em] text-white/45 font-display px-1">
        {t(lang, "results_bets_breakdown_h")}
      </h3>
      <ol className="flex flex-col gap-1.5">
        {rows.map((r) => (
          <BetRow key={r.key} row={r} lang={lang} />
        ))}
      </ol>
    </section>
  );
}

type Row =
  | { kind: "country"; key: string; label: string; you: string; truth: string | null; earned: number }
  | { kind: "bool"; key: string; label: string; you: boolean; truth: boolean | null; earned: number }
  | { kind: "number"; key: string; label: string; you: number; truth: number | null; earned: number }
  | { kind: "nul"; key: string; label: string; you: string[]; truth: string[]; earned: number };

function BetRow({ row, lang }: { row: Row; lang: Language }) {
  const won = row.earned > 0;
  return (
    <li
      className={`flex items-center gap-3 rounded-2xl px-3 py-2.5
                  ${won ? "bg-flamingo/10 ring-1 ring-flamingo/25" : "bg-white/[0.04] ring-1 ring-white/8"}`}
    >
      <div className="flex-1 min-w-0">
        <p className="text-[11px] uppercase tracking-[0.16em] text-white/55 font-display leading-tight truncate">
          {row.label}
        </p>
        <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/40 font-display leading-none">
              {t(lang, "results_you_said")}
            </p>
            <BetValue value={row.you} kind={row.kind} lang={lang} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/40 font-display leading-none">
              {t(lang, "results_it_was")}
            </p>
            <BetValue value={row.truth} kind={row.kind} lang={lang} />
          </div>
        </div>
      </div>
      <span
        className={`shrink-0 font-display tabular-nums text-sm pl-1 ${
          won ? "text-flamingo" : "text-white/30"
        }`}
      >
        {won ? `+${row.earned}` : "—"}
      </span>
    </li>
  );
}

function BetValue({
  value,
  kind,
  lang,
}: {
  value: unknown;
  kind: "country" | "bool" | "number" | "nul";
  lang: Language;
}) {
  if (value == null || (Array.isArray(value) && value.length === 0)) {
    return (
      <span className="mt-1 inline-flex items-center gap-1.5 text-sm text-white/30 italic">
        —
      </span>
    );
  }
  if (kind === "country") {
    const code = value as string;
    if (code === NONE_TOKEN) {
      return (
        <span className="mt-1 inline-flex items-center gap-1.5 text-sm text-white/75 italic">
          {t(lang, "bet_none_label")}
        </span>
      );
    }
    const c = getCountry(code);
    if (!c) {
      return (
        <span className="mt-1 inline-flex items-center gap-1.5 text-sm text-white/55">
          {code.toUpperCase()}
        </span>
      );
    }
    return (
      <span className="mt-1 inline-flex items-center gap-1.5 min-w-0">
        <HeartFlag code={c.code} size="sm" />
        <span className="text-sm truncate">{countryName(c.code, lang)}</span>
      </span>
    );
  }
  if (kind === "bool") {
    return (
      <span className="mt-1 inline-flex items-center gap-1.5 text-sm">
        {value ? t(lang, "bet_yes") : t(lang, "bet_no")}
      </span>
    );
  }
  if (kind === "number") {
    return (
      <span className="mt-1 inline-flex items-center gap-1.5 text-sm tabular-nums">
        {String(value)}
      </span>
    );
  }
  // nul televote: array of codes
  const arr = value as string[];
  return (
    <span className="mt-1 flex flex-wrap items-center gap-1">
      {arr.map((code) =>
        code === NONE_TOKEN ? (
          <span
            key={code}
            className="inline-flex items-center gap-1 rounded-full bg-white/10 ring-1 ring-white/15 px-2 h-5 text-[11px] italic"
          >
            {t(lang, "bet_none_label")}
          </span>
        ) : (
          <span
            key={code}
            className="inline-flex items-center gap-1 rounded-full bg-white/10 ring-1 ring-white/15 px-1.5 h-5 text-[11px]"
          >
            <HeartFlag code={code} size="sm" />
            <span className="tabular-nums uppercase">{code.toUpperCase()}</span>
          </span>
        ),
      )}
    </span>
  );
}
