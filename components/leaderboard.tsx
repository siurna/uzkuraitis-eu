"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Crown, ChevronDown } from "lucide-react";
import { getCountry, countryName } from "@/lib/countries";
import { Flag } from "@/components/flag";
import { ScoreBreakdown } from "@/components/score-breakdown";
import { useLeaderboard } from "@/components/leaderboard-provider";
import { ensureSessionId } from "@/lib/use-identity";
import { t } from "@/lib/i18n";
import { useLang } from "@/lib/i18n-client";

// Per-room betting leaderboard. Hidden until the admin has entered the
// official Eurovision result; once entered, scores are computed server-side
// and pushed via the "leaderboard:updated" Liveblocks broadcast so every
// connected client refreshes in lockstep.
//
// Click a row to expand and see the per-component breakdown (top-10 ballot,
// home placement, every side bet) so a player can see exactly where they
// scored and where they whiffed. Reads the same shared payload as
// MyResults + ResultsPanel via the room-level provider — no third
// redundant fetch.
//
// `code` kept in the props signature for backwards compatibility with
// existing call sites; the payload itself comes from context now.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function Leaderboard({ code }: { code: string }) {
  const { payload: data } = useLeaderboard();
  const [expanded, setExpanded] = useState<string | null>(null);
  const lang = useLang();

  if (!data?.hasResults) return null;

  const { leaderboard, homeCountryCode, homeCountryOfficialPlacement } = data;
  if (leaderboard.length === 0) return null;

  const topTotal = leaderboard[0]?.total ?? 0;
  const home = getCountry(homeCountryCode);
  const mySession = typeof window !== "undefined" ? ensureSessionId() : "";
  const total = leaderboard.length;

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

      <ol className="flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {leaderboard.map((row, i) => {
            const isOpen = expanded === row.voterId;
            const isMe = !!mySession && row.sessionId === mySession;
            const rank = i + 1;
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
                // "Me" row glows with a flamingo ring + tint so the
                // viewer can spot themselves at a glance without
                // scanning names. Everyone else keeps the cool glass
                // shell.
                className={`list-card-hover rounded-xl overflow-hidden ${
                  isMe
                    ? "bg-flamingo/12 ring-1 ring-flamingo/45 shadow-[0_4px_24px_-8px_oklch(70%_0.27_336_/_0.45)]"
                    : "glass-card"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : row.voterId)}
                  className="w-full p-3 flex items-center gap-3 text-left
                             transition active:scale-[0.99]"
                  aria-expanded={isOpen}
                >
                  {/* Rank badge — "10/14" format so each row carries
                      its own position-in-room context. The crown +
                      gold treatment for #1 takes precedence over the
                      number. Tinted to medal palette for 1/2/3. */}
                  <div
                    className={`shrink-0 h-10 min-w-[2.75rem] px-2 rounded-xl flex items-center justify-center
                                font-display text-sm tabular-nums leading-none gap-0.5
                                ${
                                  i === 0
                                    ? "bg-gold text-black"
                                    : i === 1
                                      ? "bg-white/80 text-black"
                                      : i === 2
                                        ? "bg-orange text-black"
                                        : "bg-white/[0.06] ring-1 ring-white/12 text-white/85"
                                }`}
                  >
                    {i === 0 && <Crown className="h-4 w-4 shrink-0 -ml-0.5" />}
                    <span>{rank}</span>
                    <span className={`text-xs ${i < 3 ? "text-black/55" : "text-white/55"}`}>
                      /{total}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display truncate">{row.name}</p>
                    <p className="text-xs text-white/55 truncate">
                      {row.topTen} {t(lang, "ballot_label")}
                      {row.home > 0 && (
                        <> + {row.home} {home?.name ?? "home"}</>
                      )}
                      {row.betsTotal > 0 && <> + {row.betsTotal} {t(lang, "bonuses_label")}</>}
                      {row.highlights > 0 && <> + {row.highlights} ✨</>}
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
                          highlights={row.highlights}
                          trivia={row.trivia ?? 0}
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
