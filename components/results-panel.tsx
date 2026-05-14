"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import { AnimatePresence } from "motion/react";
import { useEventListener } from "@/lib/realtime";
import { useRoomLive } from "@/components/room-shell";
import { useLeaderboard } from "@/components/leaderboard-provider";
import { ensureSessionId } from "@/lib/use-identity";
import { ScoreBreakdown } from "@/components/score-breakdown";
import { Leaderboard } from "@/components/leaderboard";
import { HeartFlag } from "@/components/flag";
import { BetsComparison } from "@/components/bets-comparison";
import { countries, countryName, getCountry } from "@/lib/countries";
import { t } from "@/lib/i18n";
import { useLang } from "@/lib/i18n-client";

type BallotPick = {
  points: number;
  countryCode: string;
  officialPlacement: number | null;
  earned: number;
};

type Profile = { ballot: BallotPick[] | null };

// "You said / it was" scorecard — for each of your TOP 10 picks, shows
// the country you put there alongside what actually finished at that
// rank and the points the gap earned you. Lives in results-panel and
// the leaderboard expanded-row.
function BallotComparison({
  ballot,
  lang,
}: {
  ballot: BallotPick[];
  lang: "en" | "lt";
}) {
  const filled = ballot.filter((b) => b.countryCode);
  if (filled.length === 0) return null;
  // Look up what country actually finished at each rank. Built from the
  // ballot rows themselves (officialPlacement is each pick's actual
  // finish, so reversing the map gets us "who finished N").
  // We're only interested in 1..10.
  const placement = new Map<number, string>();
  for (const b of ballot) {
    if (b.officialPlacement != null && b.officialPlacement >= 1 && b.officialPlacement <= 10) {
      placement.set(b.officialPlacement, b.countryCode);
    }
  }
  return (
    <section className="flex flex-col gap-2">
      {/* Single column header strip — "You said / It was" lives once
          at the top of the table instead of repeating in every row.
          Aligned to the same grid the rows use so the columns sit
          true. */}
      <div className="px-3 grid grid-cols-[28px_minmax(0,1fr)_minmax(0,1fr)_auto] gap-x-3 text-[10px] uppercase tracking-[0.18em] text-white/40 font-display">
        <span />
        <span>{t(lang, "results_you_said")}</span>
        <span>{t(lang, "results_it_was")}</span>
        <span />
      </div>
      <ol className="flex flex-col gap-1.5">
        {ballot.map((pick) => (
          <BallotComparisonRow
            key={pick.points}
            pick={pick}
            actualCode={placement.get(pick.points) ?? null}
            lang={lang}
          />
        ))}
      </ol>
    </section>
  );
}

function BallotComparisonRow({
  pick,
  actualCode,
  lang,
}: {
  pick: BallotPick;
  actualCode: string | null;
  lang: "en" | "lt";
}) {
  const youCountry = pick.countryCode ? getCountry(pick.countryCode) : null;
  const actual = actualCode ? getCountry(actualCode) : null;
  const youGotIt = !!youCountry && !!actual && youCountry.code === actual.code;
  return (
    <li
      className={`grid grid-cols-[28px_minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-x-3 rounded-2xl px-3 py-2.5
                  ${youGotIt ? "bg-flamingo/10 ring-1 ring-flamingo/25" : "bg-white/[0.04] ring-1 ring-white/8"}`}
    >
      <span className="text-flamingo font-display text-base tabular-nums">
        {pick.points}
      </span>
      <span className="flex items-center gap-1.5 min-w-0">
        {youCountry ? (
          <>
            <HeartFlag code={youCountry.code} size="sm" />
            <span className="text-sm truncate">{countryName(youCountry.code, lang)}</span>
          </>
        ) : (
          <span className="text-sm text-white/30 italic">—</span>
        )}
      </span>
      <span className="flex items-center gap-1.5 min-w-0">
        {actual ? (
          <>
            <HeartFlag code={actual.code} size="sm" />
            <span className="text-sm truncate">{countryName(actual.code, lang)}</span>
          </>
        ) : (
          <span className="text-sm text-white/30 italic">—</span>
        )}
      </span>
      <span
        className={`font-display tabular-nums text-sm pl-1 ${
          pick.earned > 0 ? "text-flamingo" : "text-white/30"
        }`}
      >
        {pick.earned > 0 ? `+${pick.earned}` : "—"}
      </span>
    </li>
  );
}

// What the Vote tab turns into once the host flips tally on: the
// player's per-component breakdown (if they voted), plus the room
// leaderboard. Lives where the ballot used to so reaching results is
// the same tap you'd use to check your TOP 10.
export function ResultsPanel() {
  const { code, homeCountryCode } = useRoomLive();
  const lang = useLang();
  // The aggregated leaderboard payload is hoisted onto the room-level
  // <LeaderboardProvider>, so MyResults (home banner) + this panel
  // share a single in-flight fetch + broadcast subscription. The
  // ballot still lives on the per-session profile route below.
  const { payload } = useLeaderboard();
  const [ballot, setBallot] = useState<BallotPick[] | null>(null);
  // Persist the "me / board" choice per-room so flipping back to
  // Results lands on whichever side the viewer was on last.
  const [tab, _setTab] = useState<"me" | "board">("me");
  const setTab = useCallback(
    (next: "me" | "board") => {
      _setTab(next);
      try {
        localStorage.setItem(`uzk_results_subtab_${code}`, next);
      } catch {
        /* ignore */
      }
    },
    [code],
  );
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`uzk_results_subtab_${code}`);
      if (saved === "me" || saved === "board") _setTab(saved);
    } catch {
      /* ignore */
    }
  }, [code]);

  // Per-pick breakdown ("you said / it was"). Lives on the profile
  // route so the same scoring helper is the single source of truth.
  // Refetched whenever the aggregated leaderboard refetches — same
  // broadcast event.
  const loadBallot = useCallback(async () => {
    const session = ensureSessionId();
    if (!session) return;
    try {
      const res = await fetch(
        `/api/rooms/${code}/profile/${encodeURIComponent(session)}?as=${encodeURIComponent(session)}`,
        { cache: "no-store" },
      );
      if (!res.ok) return;
      const data = (await res.json()) as Profile;
      setBallot(data.ballot);
    } catch {
      /* network blip */
    }
  }, [code]);

  useEffect(() => {
    loadBallot();
  }, [loadBallot]);

  // Lets the chat broadcast "Results are in" card jump straight to the
  // board sub-tab without exposing this component's state.
  useEffect(() => {
    const onSubTab = (e: Event) => {
      const sub = (e as CustomEvent).detail;
      if (sub === "me" || sub === "board") setTab(sub);
    };
    window.addEventListener("uzk:results-tab", onSubTab);
    return () => window.removeEventListener("uzk:results-tab", onSubTab);
  }, []);

  useEventListener(({ event }) => {
    if (event.type === "leaderboard:updated") loadBallot();
  });

  if (!payload || payload.leaderboard.length === 0) {
    // Same beating-heart loader as the room-gate rehydration so the
    // brand pulse carries through to every "we're fetching" moment.
    return (
      <main className="flex-1 grid place-items-center px-8 text-center">
        <div className="flex flex-col items-center gap-4 text-white/55">
          <div className="heartbeat-loop">
            {/* Plain `<img>` instead of `next/image`: iOS Safari
                paints the `drop-shadow` filter against the wrapper
                span's bounding box until the WebP fully decodes,
                rendering a transparent square halo around the heart
                on the first frame. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/70-heart.webp"
              alt=""
              width={56}
              height={56}
              className="h-14 w-14 object-contain drop-shadow-[0_0_24px_rgba(255,46,222,0.45)]"
            />
          </div>
          <p className="text-xs uppercase tracking-[0.3em] font-display">
            {t(lang, "loading")}
          </p>
        </div>
      </main>
    );
  }

  const rows = payload.leaderboard;
  const session = ensureSessionId();
  const me = rows.find((r) => r.sessionId === session) ?? null;
  const myRank = me ? rows.findIndex((r) => r.sessionId === session) + 1 : 0;
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
                    <span className={`relative inline-flex items-center gap-1.5 transition-colors ${active ? "text-dark-blue" : "text-white/65"}`}>
                      {t(lang, id === "me" ? "results_tab_me" : "results_tab_board")}
                      {/* Rank badge on the Leaderboard tab so the
                          viewer can read their "10 / 14" at a glance
                          without scrolling into the list. Tinted to
                          stay legible whether the pill is the white
                          active state or the muted resting one. */}
                      {id === "board" && me && (
                        <span
                          className={`inline-flex items-center gap-0.5 rounded-full px-2 h-5 text-[11px] tabular-nums font-display
                                       ${active
                                         ? "bg-dark-blue text-white"
                                         : "bg-white/10 text-white/75 ring-1 ring-white/12"}`}
                        >
                          <span>{myRank}</span>
                          <span className={active ? "text-white/60" : "text-white/45"}>/{rows.length}</span>
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Crossfade + slide between the two sub-tabs so the eye
            doesn't snap from "me" to "board" — same choreography we
            use for vote/results swaps in the live show. mode="wait"
            keeps the layout from briefly stacking both panels. */}
        <AnimatePresence mode="wait" initial={false}>
          {effTab === "me" && me ? (
            <motion.div
              key="me"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col gap-4"
            >
              {ballot && <BallotComparison ballot={ballot} lang={lang} />}
              <BetsComparison
                picks={me.betPicks}
                earned={me.bets}
                facts={payload.facts}
                placements={payload.placements}
                homeCountryCode={homeCountryCode}
                lang={lang}
                totalFinalists={countries.length}
              />
              <ScoreBreakdown
                topTen={me.topTen}
                home={me.home}
                bets={me.bets}
                highlights={me.highlights}
                trivia={me.trivia}
                total={me.total}
                homeName={countryName(homeCountryCode, lang)}
              />
            </motion.div>
          ) : (
            <motion.div
              key="board"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
              <Leaderboard code={code} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
