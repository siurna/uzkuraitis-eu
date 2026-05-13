"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import { Trophy } from "lucide-react";
import { useEventListener } from "@/lib/liveblocks";
import { useRoomLive, useRoomTab } from "@/components/room-shell";
import { ensureSessionId } from "@/lib/use-identity";
import { totalBetPoints, type BetBreakdown } from "@/lib/scoring";
import { t } from "@/lib/i18n";
import { useLang } from "@/lib/i18n-client";

type Row = {
  sessionId: string;
  name: string;
  topTen: number;
  home: number;
  bets: BetBreakdown;
  highlights: number;
  total: number;
};

// Home banner: once results are tallied, shows YOUR card — a big rank
// + total in a vertical layout, with a row of breakdown chips below
// (TOP10 / Home / Bets / Highlights). Tap = jump to the Results tab
// for the full breakdown + leaderboard. Hidden if results aren't in yet.
export function MyResults() {
  const { code, tallyEnabled } = useRoomLive();
  const { setTab } = useRoomTab();
  const lang = useLang();
  const [rows, setRows] = useState<Row[] | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/rooms/${code}/leaderboard`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { hasResults: boolean; leaderboard: Row[] };
      if (data.hasResults) setRows(data.leaderboard);
    } catch {
      /* network blip */
    }
  }, [code]);

  useEffect(() => {
    if (tallyEnabled) load();
  }, [tallyEnabled, load]);

  useEventListener(({ event }) => {
    if (event.type === "leaderboard:updated") load();
  });

  if (!tallyEnabled || !rows || rows.length === 0) return null;
  const session = ensureSessionId();
  const idx = rows.findIndex((r) => r.sessionId === session);
  const me = idx >= 0 ? rows[idx] : null;
  const rank = idx >= 0 ? idx + 1 : 0;
  const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
  const betsTotal = me ? totalBetPoints(me.bets) : 0;

  return (
    <div id="my-results" className="container mx-auto max-w-3xl px-4 scroll-mt-16">
      <motion.button
        type="button"
        onClick={() => setTab("vote")}
        initial={{ opacity: 0, y: 12, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 360, damping: 32 }}
        className="relative block w-full overflow-hidden rounded-3xl text-left
                   ring-1 ring-white/10
                   shadow-[0_20px_60px_-22px_oklch(45%_0.18_345_/_0.55),inset_0_1px_0_rgba(255,255,255,0.18)]"
        style={{ background: "linear-gradient(155deg, #f5a302 0%, #d61570 48%, #4c0a54 100%)" }}
      >
        {/* Top gloss — gives the card a polished, skeumorphic top edge. */}
        <span
          className="pointer-events-none absolute inset-x-0 top-0 h-1/3"
          style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.20), transparent)" }}
          aria-hidden
        />
        <div className="relative flex flex-col gap-4 p-5">
          {/* Eyebrow + name */}
          <header className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.3em] text-white/80 font-display leading-tight flex items-center gap-1.5">
                <Trophy className="h-3 w-3" fill="currentColor" />
                {t(lang, me ? "home_my_results" : "home_results_in")}
              </p>
              {me ? (
                <p className="font-display text-base text-white/95 truncate leading-tight mt-0.5">
                  {me.name}
                </p>
              ) : (
                <p className="text-xs text-white/70 leading-snug mt-0.5">
                  {t(lang, "home_results_in_sub")}
                </p>
              )}
            </div>
            {me && (
              <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-white/18 ring-1 ring-white/30 px-3 h-7 text-sm text-white font-display tabular-nums">
                <span>{medal ?? `#${rank}`}</span>
                <span className="text-white/70 text-xs">
                  / {rows.length}
                </span>
              </span>
            )}
          </header>

          {me ? (
            <>
              {/* Total — the showpiece number, centred so it carries the card. */}
              <div className="flex items-baseline gap-2 justify-center">
                <span
                  className="font-display tabular-nums leading-none text-white drop-shadow"
                  style={{ fontSize: "clamp(3.25rem, 14vw, 5rem)" }}
                >
                  {me.total}
                </span>
                <span className="text-base font-display text-white/75 tracking-wider uppercase">
                  {t(lang, "pts_short")}
                </span>
              </div>

              {/* Breakdown chips — quick read of where the points came
                  from. Zero-value categories stay hidden to avoid noise. */}
              <ul className="flex flex-wrap items-center justify-center gap-1.5 text-[12px]">
                {me.topTen > 0 && <Chip label={t(lang, "breakdown_top_ten")} value={`+${me.topTen}`} />}
                {me.home > 0 && <Chip label={t(lang, "breakdown_home")} value={`+${me.home}`} />}
                {betsTotal > 0 && <Chip label={t(lang, "breakdown_bets_sum")} value={`+${betsTotal}`} />}
                {me.highlights > 0 && (
                  <Chip label={t(lang, "breakdown_highlights")} value={`+${me.highlights}`} />
                )}
              </ul>
              {/* Tap-affordance hint */}
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/65 font-display text-center">
                {t(lang, "home_my_results_tap")}
              </p>
            </>
          ) : null}
        </div>
      </motion.button>
    </div>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <li className="inline-flex items-center gap-1 rounded-full bg-white/15 ring-1 ring-white/22 px-2.5 h-7 text-white/90 font-display">
      <span className="text-white/70">{label}</span>
      <span className="tabular-nums text-white">{value}</span>
    </li>
  );
}
