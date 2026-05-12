"use client";

import { HOST_COUNTRY, type BetBreakdown } from "@/lib/scoring";
import { countryName } from "@/lib/countries";
import { useLang, t, fmt, type MessageKey } from "@/lib/i18n";

// The per-component score breakdown (TOP10 ballot + home placement +
// every side bet → points). Shared by the leaderboard's expanded row
// and the "your results" card on Home. i18n'd via the existing bet_*
// keys.
export function ScoreBreakdown({
  topTen,
  home,
  bets,
  total,
  homeName,
}: {
  topTen: number;
  home: number;
  bets: BetBreakdown;
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
    { label: t(lang, "bet_host_top3"), pts: bets.hostTop3 },
    { label: t(lang, "bet_solo_winner"), pts: bets.winnerSolo },
  ];
  return (
    <ul className="flex flex-col gap-0.5 text-sm">
      {lines.map((l) => (
        <li
          key={l.label}
          className={`flex items-center justify-between py-1 ${
            l.pts === 0 ? "text-white/35" : "text-white/80"
          }`}
        >
          <span className="truncate pr-2">{l.label}</span>
          <span className={`font-display tabular-nums shrink-0 ${l.pts > 0 ? "text-flamingo" : "text-white/30"}`}>
            {l.pts > 0 ? `+${l.pts}` : "—"}
          </span>
        </li>
      ))}
      <li className="flex items-center justify-between pt-2 mt-1 border-t border-white/8">
        <span className="font-display">{t(lang, "breakdown_total")}</span>
        <span className="font-display text-flamingo tabular-nums text-base">{total}</span>
      </li>
    </ul>
  );
}
