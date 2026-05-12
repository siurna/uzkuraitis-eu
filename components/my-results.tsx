"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, Trophy } from "lucide-react";
import { useEventListener } from "@/lib/liveblocks";
import { useRoomLive } from "@/components/room-shell";
import { ensureSessionId } from "@/lib/use-identity";
import { ScoreBreakdown } from "@/components/score-breakdown";
import { countryName } from "@/lib/countries";
import type { BetBreakdown } from "@/lib/scoring";
import { useLang, t } from "@/lib/i18n";

type Row = {
  sessionId: string;
  name: string;
  topTen: number;
  home: number;
  bets: BetBreakdown;
  total: number;
};

// Home-page card: once results are tallied, shows YOUR rank + total +
// (tap-to-expand) the full per-component breakdown. Hidden if results
// aren't in yet or you didn't vote this round.
export function MyResults() {
  const { code, tallyEnabled, homeCountryCode } = useRoomLive();
  const lang = useLang();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [expanded, setExpanded] = useState(false);

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
    if ((event as { type?: string }).type === "leaderboard:updated") load();
  });

  if (!tallyEnabled || !rows) return null;
  const session = ensureSessionId();
  const idx = rows.findIndex((r) => r.sessionId === session);
  if (idx === -1) return null; // didn't vote
  const me = rows[idx];
  const rank = idx + 1;
  const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;

  return (
    <div id="my-results" className="container mx-auto max-w-3xl px-4 scroll-mt-16">
      <div className="rainbow-border rounded-3xl">
        <div className="rounded-[22px] bg-dark-blue-900/90 overflow-hidden">
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="flex items-center gap-4 w-full px-5 py-5 text-left"
          >
            <span className="shrink-0 grid place-items-center h-14 w-14 rounded-2xl bg-white/[0.07] ring-1 ring-white/12 text-2xl font-display text-white">
              {medal ?? `#${rank}`}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-[0.3em] text-gold font-display leading-tight mb-0.5 flex items-center gap-1.5">
                <Trophy className="h-3 w-3" />
                {t(lang, "home_my_results")}
              </p>
              <p className="font-display text-lg text-white truncate leading-tight">{me.name}</p>
              <p className="text-xs text-white/55 leading-tight">
                {t(lang, "home_my_results_rank", rank, rows.length)}
              </p>
            </div>
            <span className="text-right shrink-0">
              <span className="block font-display text-3xl text-flamingo tabular-nums leading-none">{me.total}</span>
              <span className="block text-[10px] uppercase tracking-wider text-white/40 mt-0.5">{t(lang, "pts_short")}</span>
            </span>
            <ChevronDown className={`h-4 w-4 text-white/30 shrink-0 transition ${expanded ? "rotate-180" : ""}`} />
          </button>
          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className="overflow-hidden border-t border-white/8"
              >
                <div className="px-5 py-4">
                  <ScoreBreakdown
                    topTen={me.topTen}
                    home={me.home}
                    bets={me.bets}
                    total={me.total}
                    homeName={countryName(homeCountryCode, lang)}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
