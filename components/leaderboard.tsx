"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Crown, ChevronDown } from "lucide-react";
import { getCountry, countryName } from "@/lib/countries";
import { Flag } from "@/components/flag";
import { ScoreBreakdown } from "@/components/score-breakdown";
import { useLeaderboard } from "@/components/leaderboard-provider";
import { FluentEmoji } from "@/components/fluent-emoji";
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
                  {/* Reverted to the original medal-disc badge — gold
                      crown for #1, silver / bronze for 2 / 3, flamingo
                      pill for the rest. The room-position (10/14)
                      signal moved to the Results tab pill itself so
                      this row stays clean. The bg-* base tint stays
                      the same; a subtle top-down gradient overlay
                      gives each disc a touch of dimensionality so it
                      reads like a real coin / chip rather than a flat
                      filled circle. */}
                  <div
                    className={`shrink-0 h-10 w-10 rounded-full flex items-center justify-center font-display text-base
                                ring-1 ring-black/10
                                shadow-[inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-2px_4px_rgba(0,0,0,0.18)]
                                bg-gradient-to-b ${
                      i === 0
                        ? "from-gold/100 to-gold/75 text-black"
                        : i === 1
                          ? "from-white/95 to-white/65 text-black"
                          : i === 2
                            ? "from-orange/100 to-orange/70 text-black"
                            : "from-flamingo/95 to-flamingo/60 text-white"
                    }`}
                  >
                    {i === 0 ? <Crown className="h-5 w-5" /> : rank}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display truncate">{row.name}</p>
                    <p className="text-xs text-white/55 truncate">
                      {row.topTen} {t(lang, "ballot_label")}
                      {row.home > 0 && (
                        <> + {row.home} {home?.name ?? "home"}</>
                      )}
                      {row.betsTotal > 0 && <> + {row.betsTotal} {t(lang, "bonuses_label")}</>}
                      {row.highlights > 0 && (
                        <> + {row.highlights}{" "}
                          <FluentEmoji glyph="✨" size={11} className="align-[-0.05em]" />
                        </>
                      )}
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
                    // Opacity + small y-offset instead of a height
                    // tween. The previous `height: 0 ↔ "auto"` +
                    // `overflow-hidden` wrapper clipped the
                    // ScoreBreakdown chips' `ring-1` outlines, which
                    // live OUTSIDE the element's border box (rings
                    // are outset box-shadows). Per CLAUDE.md, the
                    // parent flex absorbs the natural height
                    // immediately; the fade covers the visual jump.
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.22, ease: "easeOut" }}
                      className="border-t border-white/5"
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
