"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import { useEventListener } from "@/lib/liveblocks";
import { useRoomLive } from "@/components/room-shell";
import { ensureSessionId } from "@/lib/use-identity";
import { ScoreBreakdown } from "@/components/score-breakdown";
import { Leaderboard } from "@/components/leaderboard";
import { countryName } from "@/lib/countries";
import type { BetBreakdown } from "@/lib/scoring";
import { t } from "@/lib/i18n";
import { useLang } from "@/lib/i18n-client";

type Row = {
  sessionId: string;
  name: string;
  topTen: number;
  home: number;
  bets: BetBreakdown;
  highlights: number;
  trivia: number;
  total: number;
};

// What the Vote tab turns into once the host flips tally on: the
// player's per-component breakdown (if they voted), plus the room
// leaderboard. Lives where the ballot used to so reaching results is
// the same tap you'd use to check your TOP 10.
export function ResultsPanel() {
  const { code, homeCountryCode } = useRoomLive();
  const lang = useLang();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [tab, setTab] = useState<"me" | "board">("me");

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
    load();
  }, [load]);

  useEventListener(({ event }) => {
    if (event.type === "leaderboard:updated") load();
  });

  if (!rows || rows.length === 0) {
    return (
      <main className="flex-1 grid place-items-center text-white/45 px-8 text-center">
        <p className="text-sm">{t(lang, "loading")}</p>
      </main>
    );
  }

  const session = ensureSessionId();
  const idx = rows.findIndex((r) => r.sessionId === session);
  const me = idx >= 0 ? rows[idx] : null;
  const rank = idx >= 0 ? idx + 1 : 0;
  const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
  const effTab = me ? tab : "board";

  return (
    <main className="flex flex-col">
      <div className="container mx-auto max-w-3xl px-4 pt-5 pb-4 flex flex-col gap-4">
        {me && (
          <div className="flex justify-center">
            <div className="inline-flex items-center gap-1 rounded-2xl bg-black/40 ring-1 ring-white/10 p-1">
              {(["me", "board"] as const).map((id) => {
                const active = effTab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTab(id)}
                    className="relative px-4 h-11 rounded-xl font-display text-sm"
                  >
                    {active && (
                      <motion.span
                        layoutId="results-panel-pill"
                        className="absolute inset-0 rounded-xl bg-white"
                        transition={{ type: "spring", stiffness: 380, damping: 32 }}
                      />
                    )}
                    <span className={`relative transition-colors ${active ? "text-dark-blue" : "text-white/65"}`}>
                      {t(lang, id === "me" ? "results_tab_me" : "results_tab_board")}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {effTab === "me" && me ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 rounded-2xl bg-white/[0.04] ring-1 ring-white/8 px-4 py-3">
              <span className="shrink-0 grid place-items-center h-11 w-11 rounded-xl bg-white/[0.07] ring-1 ring-white/12 text-xl font-display text-white">
                {medal ?? `#${rank}`}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display text-white truncate leading-tight">{me.name}</p>
                <p className="text-xs text-white/55 leading-tight">
                  {t(lang, "home_my_results_rank", rank, rows.length)}
                </p>
              </div>
              <span className="text-right shrink-0">
                <span className="block font-display text-2xl text-flamingo tabular-nums leading-none">
                  {me.total}
                </span>
                <span className="block text-[10px] uppercase tracking-wider text-white/40 mt-0.5">
                  {t(lang, "pts_short")}
                </span>
              </span>
            </div>
            <ScoreBreakdown
              topTen={me.topTen}
              home={me.home}
              bets={me.bets}
              highlights={me.highlights}
              trivia={me.trivia}
              total={me.total}
              homeName={countryName(homeCountryCode, lang)}
            />
          </div>
        ) : (
          <Leaderboard code={code} />
        )}
      </div>
    </main>
  );
}
