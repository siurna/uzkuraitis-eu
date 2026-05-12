"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Crown, Trophy, ChevronDown, Sparkles } from "lucide-react";
import { useEventListener } from "@/lib/liveblocks";
import { getCountry, countryName } from "@/lib/countries";
import { Flag } from "@/components/flag";
import { ResultsReveal } from "@/components/results-reveal";
import { ScoreBreakdown } from "@/components/score-breakdown";
import { ensureSessionId } from "@/lib/use-identity";
import type { BetBreakdown } from "@/lib/scoring";
import { useLang, t } from "@/lib/i18n";

type Row = {
  voterId: string;
  sessionId: string;
  name: string;
  homePrediction: number | null;
  topTen: number;
  home: number;
  bets: BetBreakdown;
  betsTotal: number;
  total: number;
};

type Response = {
  hasResults: boolean;
  homeCountryCode: string;
  homeCountryOfficialPlacement?: number | null;
  leaderboard: Row[];
};

// Per-room betting leaderboard. Hidden until the admin has entered the
// official Eurovision result; once entered, scores are computed server-side
// and pushed via the "leaderboard:updated" Liveblocks broadcast so every
// connected client refreshes in lockstep.
//
// Click a row to expand and see the per-component breakdown (top-10 ballot,
// home placement, every side bet) so a player can see exactly where they
// scored and where they whiffed.
export function Leaderboard({ code }: { code: string }) {
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [revealOpen, setRevealOpen] = useState(false);
  const [session, setSession] = useState<string>("");
  const lang = useLang();

  useEffect(() => {
    setSession(ensureSessionId());
  }, []);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch(`/api/rooms/${code}/leaderboard`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const json = (await res.json()) as Response;
      setData(json);
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  useEventListener(({ event }) => {
    if (
      (event as { type?: string }).type === "leaderboard:updated" ||
      (event as { type?: string }).type === "scores:updated"
    ) {
      fetchLeaderboard();
    }
  });

  if (loading || !data?.hasResults) return null;

  const { leaderboard, homeCountryCode, homeCountryOfficialPlacement } = data;
  if (leaderboard.length === 0) return null;

  const topTotal = leaderboard[0]?.total ?? 0;
  const home = getCountry(homeCountryCode);
  const myRow = leaderboard.find((r) => r.sessionId === session) ?? null;

  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-center gap-2">
        <h3 className="text-2xl font-display gradient-text">{t(lang, "leaderboard")}</h3>
        {home && homeCountryOfficialPlacement != null && (
          <span className="ml-auto text-xs text-white/50 inline-flex items-center gap-1.5">
            <Flag code={home.code} size="sm" />
            {t(lang, "finished")} {homeCountryOfficialPlacement}
          </span>
        )}
      </header>

      {/* Personal reveal — appears once the leaderboard is live and the
          voter has a row. Tapping plays the full bet-by-bet reveal. */}
      {myRow && (
        <button
          type="button"
          onClick={() => setRevealOpen(true)}
          className="rainbow-border rounded-2xl block"
        >
          <span className="block w-full h-12 rounded-[14px]
                           bg-white text-dark-blue font-display
                           inline-flex items-center justify-center gap-2">
            <Sparkles className="h-4 w-4" />
            {t(lang, "reveal_cta")}
          </span>
        </button>
      )}

      {myRow && (
        <ResultsReveal
          row={myRow}
          homeName={home?.name ?? "Home"}
          open={revealOpen}
          onClose={() => setRevealOpen(false)}
        />
      )}

      <ol className="flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {leaderboard.map((row, i) => {
            const isOpen = expanded === row.voterId;
            return (
              <motion.li
                key={row.voterId}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{
                  layout: { type: "spring", stiffness: 320, damping: 30 },
                }}
                className="list-card-hover glass-card rounded-xl overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : row.voterId)}
                  className="w-full p-3 flex items-center gap-3 text-left
                             transition active:scale-[0.99]"
                  aria-expanded={isOpen}
                >
                  <div
                    className={`shrink-0 h-10 w-10 rounded-full flex items-center justify-center font-display text-base ${
                      i === 0
                        ? "bg-gold text-black"
                        : i === 1
                          ? "bg-white/80 text-black"
                          : i === 2
                            ? "bg-orange text-black"
                            : "bg-flamingo/80 text-white"
                    }`}
                  >
                    {i === 0 ? <Crown className="h-5 w-5" /> : i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display truncate">{row.name}</p>
                    <p className="text-xs text-white/55 truncate">
                      {row.topTen} {t(lang, "ballot_label")}
                      {row.home > 0 && (
                        <> + {row.home} {home?.name ?? "home"}</>
                      )}
                      {row.betsTotal > 0 && <> + {row.betsTotal} {t(lang, "bonuses_label")}</>}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className="font-display text-2xl tabular-nums leading-none origin-right"
                      style={{
                        color:
                          row.total === topTotal && topTotal > 0
                            ? "oklch(82% 0.16 85)"
                            : "oklch(70.55% 0.2725 336.19)",
                      }}
                    >
                      {row.total}
                    </p>
                    <p className="text-[10px] uppercase tracking-widest text-white/40">
                      pts
                    </p>
                  </div>
                  <motion.div
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="shrink-0 ml-1 text-white/35"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </motion.div>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22, ease: "easeOut" }}
                      className="overflow-hidden border-t border-white/5"
                    >
                      <div className="px-4 py-3">
                        <ScoreBreakdown
                          topTen={row.topTen}
                          home={row.home}
                          bets={row.bets}
                          total={row.total}
                          homeName={countryName(homeCountryCode, lang)}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ol>
    </section>
  );
}
