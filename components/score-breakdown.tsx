"use client";

import { HOST_COUNTRY, type BetBreakdown } from "@/lib/scoring";
import { countryName } from "@/lib/countries";
import { t, fmt, type MessageKey } from "@/lib/i18n";
import { useLang } from "@/lib/i18n-client";

// The per-component score breakdown (TOP10 ballot + home placement +
// every side bet → points). Shared by the leaderboard's expanded row
// and the "your results" card on Home. i18n'd via the existing bet_*
// keys.
export function ScoreBreakdown({
  topTen,
  home,
  bets,
  highlights,
  trivia = 0,
  total,
  homeName,
}: {
  topTen: number;
  home: number;
  bets: BetBreakdown;
  highlights: number;
  trivia?: number;
  total: number;
  homeName: string;
}) {
  const lang = useLang();
  const tpl = (k: MessageKey) =>
    fmt(t(lang, k), { home: homeName, host: countryName(HOST_COUNTRY, lang) });
  const lines: { label: string; pts: number }[] = [
    { label: t(lang, "rules_top10_h"), pts: topTen },
    { label: tpl("bet_lt_placement"), pts: home },
    { label: tpl("bet_lt_total"), pts: bets.ltTotalPoints },
    { label: t(lang, "bet_wooden_spoon"), pts: bets.woodenSpoon },
    { label: tpl("bet_lt_12_to"), pts: bets.lt12To },
    { label: t(lang, "bet_big5"), pts: bets.highestBig5 },
    { label: t(lang, "bet_jury_winner"), pts: bets.juryWinner },
    { label: t(lang, "bet_televote_winner"), pts: bets.televoteWinner },
    { label: t(lang, "bet_nul"), pts: bets.nulTelevote },
    { label: tpl("bet_host_top3"), pts: bets.hostTop3 },
    { label: t(lang, "bet_solo_winner"), pts: bets.winnerSolo },
    { label: t(lang, "breakdown_highlights"), pts: highlights },
    { label: t(lang, "trivia_eyebrow"), pts: trivia },
  ];
  return (
    // Every component renders at the same visual weight so the
    // breakdown reads as a complete scorecard (which bets you hit,
    // which you missed) rather than a list of wins with the misses
    // half-faded. Zero-point rows get a quiet "0" chip + muted label
    // colour; non-zero rows get the flamingo +N chip.
    <ul className="flex flex-col">
      {lines.map((l, i) => (
        <li
          key={l.label}
          className={`flex items-center justify-between py-2 ${
            i > 0 ? "border-t border-white/5" : ""
          }`}
        >
          <span
            className={`text-sm truncate pr-2 ${l.pts > 0 ? "text-white/90" : "text-white/55"}`}
          >
            {l.label}
          </span>
          <span
            className={`shrink-0 inline-flex items-center justify-center rounded-full px-2 h-6 text-xs font-display tabular-nums
                        ${
                          l.pts > 0
                            ? "bg-flamingo/20 ring-1 ring-flamingo/40 text-flamingo"
                            : "bg-white/[0.04] ring-1 ring-white/10 text-white/40"
                        }`}
          >
            {l.pts > 0 ? `+${l.pts}` : "0"}
          </span>
        </li>
      ))}
      <li className="flex items-center justify-between pt-3 mt-2 border-t border-white/15">
        <span className="font-display text-base">{t(lang, "breakdown_total")}</span>
        <span className="font-display text-flamingo tabular-nums text-lg">{total}</span>
      </li>
    </ul>
  );
}
