"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { motion } from "motion/react";
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
      <h3 className="text-[11px] uppercase tracking-[0.2em] text-white/45 font-display px-1">
        {t(lang, "results_pick_vs_actual_h")}
      </h3>
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
      className={`flex items-center gap-3 rounded-2xl px-3 py-2.5
                  ${youGotIt ? "bg-flamingo/10 ring-1 ring-flamingo/25" : "bg-white/[0.04] ring-1 ring-white/8"}`}
    >
      <span className="shrink-0 w-7 text-flamingo font-display text-base tabular-nums">
        {pick.points}
      </span>
      <div className="flex-1 min-w-0 grid grid-cols-2 gap-x-3 gap-y-0.5">
        {/* "You said" */}
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/40 font-display leading-none">
            {t(lang, "results_you_said")}
          </p>
          <div className="flex items-center gap-1.5 mt-1 min-w-0">
            {youCountry ? (
              <>
                <HeartFlag code={youCountry.code} size="sm" />
                <span className="text-sm truncate">{countryName(youCountry.code, lang)}</span>
              </>
            ) : (
              <span className="text-sm text-white/30 italic">—</span>
            )}
          </div>
        </div>
        {/* "It was" */}
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/40 font-display leading-none">
            {t(lang, "results_it_was")}
          </p>
          <div className="flex items-center gap-1.5 mt-1 min-w-0">
            {actual ? (
              <>
                <HeartFlag code={actual.code} size="sm" />
                <span className="text-sm truncate">{countryName(actual.code, lang)}</span>
              </>
            ) : (
              <span className="text-sm text-white/30 italic">—</span>
            )}
          </div>
        </div>
      </div>
      <span
        className={`shrink-0 font-display tabular-nums text-sm pl-1 ${
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
  const [tab, setTab] = useState<"me" | "board">("me");

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
            <Image
              src="/images/70-heart.webp"
              alt=""
              width={56}
              height={56}
              priority
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
            {/* The rank/total card used to live here; that signal now
                rides on the leaderboard row's "10/14" badge (the
                viewer's row is highlighted in flamingo over there).
                The breakdown sections below carry the rest of the
                "where did your points come from" story. */}

            {/* "You said / it was" — per-pick comparison for the TOP10
                ballot. Reads as a scorecard: each row shows the pick at
                that rank, what the country actually finished, and the
                earned points. */}
            {ballot && <BallotComparison ballot={ballot} lang={lang} />}

            {/* Same shape applied to the BONUS bets. Reuses the picks +
                facts/placements that ride along on the leaderboard
                response. Self-hides when the voter didn't place any
                bets, so the rest of the breakdown still reads. */}
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
          </div>
        ) : (
          <Leaderboard code={code} />
        )}
      </div>
    </main>
  );
}
