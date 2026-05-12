"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import { Trophy, ChevronRight } from "lucide-react";
import { useEventListener } from "@/lib/liveblocks";
import { useRoomLive } from "@/components/room-shell";
import { ensureSessionId } from "@/lib/use-identity";
import { ScoreBreakdown } from "@/components/score-breakdown";
import { Leaderboard } from "@/components/leaderboard";
import { BottomSheet } from "@/components/ui/bottom-sheet";
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

// Home card: once results are tallied, shows YOUR rank + total; tap to
// open a drawer with two tabs — your full per-component breakdown, and
// the whole room's leaderboard. Hidden if results aren't in yet or you
// didn't vote this round.
export function MyResults() {
  const { code, tallyEnabled, homeCountryCode } = useRoomLive();
  const lang = useLang();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [open, setOpen] = useState(false);
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
    if (tallyEnabled) load();
  }, [tallyEnabled, load]);

  useEventListener(({ event }) => {
    if ((event as { type?: string }).type === "leaderboard:updated") load();
  });

  // The Home "Results are in" promo opens this drawer (on the "me" tab)
  // instead of scroll-jumping to the card.
  useEffect(() => {
    const open = () => {
      setOpen(true);
      setTab("me");
    };
    window.addEventListener("uzk:open-results", open);
    return () => window.removeEventListener("uzk:open-results", open);
  }, []);

  if (!tallyEnabled || !rows || rows.length === 0) return null;
  const session = ensureSessionId();
  const idx = rows.findIndex((r) => r.sessionId === session);
  const me = idx >= 0 ? rows[idx] : null;
  const rank = idx >= 0 ? idx + 1 : 0;
  const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
  // If you didn't vote there's no "my breakdown" — the drawer is just
  // the leaderboard, and the trigger card invites you to peek.
  const effTab = me ? tab : "board";

  return (
    <>
      <div id="my-results" className="container mx-auto max-w-3xl px-4 scroll-mt-16">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full text-left rainbow-border rounded-3xl block transform-gpu transition duration-150 active:scale-[0.99]"
        >
          <div className="flex items-center gap-4 rounded-[22px] bg-dark-blue-900/90 px-5 py-5">
            <span className="shrink-0 grid place-items-center h-14 w-14 rounded-2xl bg-white/[0.07] ring-1 ring-white/12 text-2xl font-display text-white">
              {me ? (medal ?? `#${rank}`) : "🏆"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-[0.3em] text-gold font-display leading-tight mb-0.5 flex items-center gap-1.5">
                <Trophy className="h-3 w-3" />
                {t(lang, me ? "home_my_results" : "home_results_in")}
              </p>
              {me ? (
                <>
                  <p className="font-display text-lg text-white truncate leading-tight">{me.name}</p>
                  <p className="text-xs text-white/55 leading-tight">
                    {t(lang, "home_my_results_rank", rank, rows.length)}
                  </p>
                </>
              ) : (
                <p className="text-sm text-white/55 leading-snug mt-0.5">{t(lang, "home_results_in_sub")}</p>
              )}
            </div>
            {me && (
              <span className="text-right shrink-0">
                <span className="block font-display text-3xl text-flamingo tabular-nums leading-none">{me.total}</span>
                <span className="block text-[10px] uppercase tracking-wider text-white/40 mt-0.5">{t(lang, "pts_short")}</span>
              </span>
            )}
            <ChevronRight className="h-4 w-4 text-dark-blue-300 shrink-0" />
          </div>
        </button>
      </div>

      <BottomSheet open={open} onClose={() => setOpen(false)} title={t(lang, "home_my_results")}>
        <div className="flex flex-col gap-4">
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
                      className="relative px-4 h-10 rounded-xl font-display text-sm"
                    >
                      {active && (
                        <motion.span
                          layoutId="results-tab-pill"
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
                  <p className="text-xs text-white/55 leading-tight">{t(lang, "home_my_results_rank", rank, rows.length)}</p>
                </div>
                <span className="text-right shrink-0">
                  <span className="block font-display text-2xl text-flamingo tabular-nums leading-none">{me.total}</span>
                  <span className="block text-[10px] uppercase tracking-wider text-white/40 mt-0.5">{t(lang, "pts_short")}</span>
                </span>
              </div>
              <ScoreBreakdown
                topTen={me.topTen}
                home={me.home}
                bets={me.bets}
                total={me.total}
                homeName={countryName(homeCountryCode, lang)}
              />
            </div>
          ) : (
            <Leaderboard code={code} />
          )}
        </div>
      </BottomSheet>
    </>
  );
}
