"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence, LayoutGroup } from "motion/react";
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Mic,
  Music,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { countries, getCountry } from "@/lib/countries";
import { useEventListener } from "@/lib/liveblocks";
import { HeartFlag, MetaPill } from "@/components/flag";
import { Leaderboard } from "@/components/leaderboard";
import { useRoomLive } from "@/components/room-shell";
import { useLang, t } from "@/lib/i18n";

type ScoreRow = {
  code: string;
  name: string;
  flag: string;
  totalPoints: number;
  points12: number;
  points10: number;
};

type VoterRow = {
  id: string;
  name: string;
  votes: Record<string, string>;
};

type ScoresResponse = {
  scores: ScoreRow[];
  voters: VoterRow[];
};

export function Standings() {
  // Live room props (votingEnabled flips when admin toggles).
  const { code, votingEnabled } = useRoomLive();
  const lang = useLang();

  const [scores, setScores] = useState<ScoreRow[]>([]);
  const [voters, setVoters] = useState<VoterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);

  const prevRanks = useRef<Map<string, number>>(new Map());
  const prevScores = useRef<Map<string, number>>(new Map());
  const [rankDeltas, setRankDeltas] = useState<Record<string, number>>({});
  // Per-country running queue of "+N" point pops, keyed by an ever-
  // incrementing id so multiple in-flight pops on the same country
  // can each animate independently.
  const [pointPops, setPointPops] = useState<
    Array<{ id: number; code: string; delta: number }>
  >([]);

  const fetchScores = useCallback(async () => {
    try {
      const res = await fetch(`/api/rooms/${code}/scores`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as ScoresResponse;
      setScores(data.scores);
      setVoters(data.voters);
    } finally {
      setLoading(false);
    }
  }, [code]);

  // Initial load + slow fallback poll. Primary update path is the
  // Liveblocks scores:updated broadcast; this 60s poll is a safety net
  // for stalled WebSockets, dropped broadcasts, or misconfigured
  // Liveblocks credentials. Cheap to run.
  useEffect(() => {
    fetchScores();
    const id = setInterval(fetchScores, 60_000);
    return () => clearInterval(id);
  }, [fetchScores]);

  // Liveblocks-driven updates: the votes API broadcasts "scores:updated"
  // after a successful submit, every connected client refetches once.
  // No polling.
  useEventListener(({ event }) => {
    if ((event as { type?: string }).type === "scores:updated") {
      fetchScores();
    }
  });

  useEffect(() => {
    const stored = localStorage.getItem(`uzk_voted_${code}`);
    setHasVoted(stored === "1");
  }, [code]);

  const allWithZero = (() => {
    const map = new Map(scores.map((s) => [s.code, s]));
    return countries
      .map((c) =>
        map.get(c.code) ?? {
          code: c.code,
          name: c.name,
          flag: c.flag,
          totalPoints: 0,
          points12: 0,
          points10: 0,
        },
      )
      .sort((a, b) => {
        if (b.totalPoints !== a.totalPoints)
          return b.totalPoints - a.totalPoints;
        return (
          (getCountry(a.code)?.order ?? 999) -
          (getCountry(b.code)?.order ?? 999)
        );
      });
  })();

  const visible = showAll ? allWithZero : scores.slice(0, 5);

  useEffect(() => {
    // Rank deltas (visible badge "+3" / "-2").
    const deltas: Record<string, number> = {};
    visible.forEach((row, i) => {
      const prev = prevRanks.current.get(row.code);
      if (prev !== undefined && prev !== i) deltas[row.code] = prev - i;
    });

    // Point deltas: queue a fly-up "+N" pop for any country whose score
    // changed since the previous render. Skip the first-ever render
    // (prevScores empty) so we don't spam pops on initial load.
    const hadPrev = prevScores.current.size > 0;
    if (hadPrev) {
      const pops: Array<{ id: number; code: string; delta: number }> = [];
      let nextId = Date.now();
      for (const row of visible) {
        const prev = prevScores.current.get(row.code) ?? 0;
        const diff = row.totalPoints - prev;
        if (diff > 0) {
          pops.push({ id: nextId++, code: row.code, delta: diff });
        }
      }
      if (pops.length > 0) {
        setPointPops((prev) => [...prev, ...pops]);
        // Clean up after the animation finishes.
        const stale = pops.map((p) => p.id);
        setTimeout(() => {
          setPointPops((prev) => prev.filter((p) => !stale.includes(p.id)));
        }, 1700);
      }
    }

    if (Object.keys(deltas).length > 0) {
      setRankDeltas(deltas);
      const t = setTimeout(() => setRankDeltas({}), 2400);
      visible.forEach((row, i) => prevRanks.current.set(row.code, i));
      visible.forEach((row) =>
        prevScores.current.set(row.code, row.totalPoints),
      );
      return () => clearTimeout(t);
    }
    visible.forEach((row, i) => prevRanks.current.set(row.code, i));
    visible.forEach((row) =>
      prevScores.current.set(row.code, row.totalPoints),
    );
  }, [visible]);

  return (
    <main className="container mx-auto max-w-3xl px-4 py-6 flex-1 flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-10 w-10 animate-spin text-flamingo" />
          </div>
        ) : visible.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card rounded-xl p-8 text-center text-white/60 font-display"
          >
            {t(lang, "no_votes_yet")}
          </motion.div>
        ) : (
          // LayoutGroup so rank-changes animate cleanly across rows.
          // AnimatePresence mode="popLayout" so expanding from 5 -> 35
          // doesn't herd every layout transform at once. Stagger via
          // variants so 30 rows don't all enter on the same frame.
          <LayoutGroup>
            <motion.ol
              className="flex flex-col gap-2"
              initial={false}
              animate="show"
              variants={{
                show: { transition: { staggerChildren: 0.015 } },
              }}
            >
              <AnimatePresence initial={false} mode="popLayout">
                {visible.map((s, i) => (
                  <CountryRow
                    key={s.code}
                    score={s}
                    index={i}
                    delta={rankDeltas[s.code]}
                    pops={pointPops.filter((p) => p.code === s.code)}
                  />
                ))}
              </AnimatePresence>
            </motion.ol>
          </LayoutGroup>
        )}

        {scores.length > 0 && (
          <Button
            variant="ghost"
            onClick={() => setShowAll((v) => !v)}
            className="mt-1 text-flamingo hover:text-flamingo/80 font-display"
          >
            {showAll ? (
              <>
                <ChevronUp className="h-4 w-4 mr-2" /> {t(lang, "show_top_5")}
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-2" /> {t(lang, "show_all")}{" "}
                {countries.length}
              </>
            )}
          </Button>
        )}
      </section>

      <Leaderboard code={code} />

      {/* Activity-style cast-vote CTA. Hidden when the admin has closed
          voting — the room then reads as "watching mode, react with
          emojis". On mobile we render the CTA via a separate sticky
          footer (see room-shell) so this inline copy only shows on
          larger viewports. */}
      <AnimatePresence>
        {votingEnabled && (
          <motion.div
            key="vote-cta"
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="hidden sm:block"
          >
            <Link
              href={`/r/${code}/vote`}
              className="rainbow-border rounded-2xl"
            >
              <Button
                className="w-full h-14 text-lg font-display rounded-[14px]
                           bg-white text-dark-blue hover:bg-dark-blue-50"
              >
                {hasVoted ? t(lang, "update_vote") : t(lang, "cast_vote")}
              </Button>
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

function CountryRow({
  score,
  index,
  delta,
  pops,
}: {
  score: ScoreRow;
  index: number;
  delta?: number;
  pops?: Array<{ id: number; code: string; delta: number }>;
}) {
  const detail = getCountry(score.code);
  const badge = (() => {
    if (index === 0) return "bg-gold text-black";
    if (index === 1) return "bg-white/80 text-black";
    if (index === 2) return "bg-orange text-black";
    return "bg-flamingo/80 text-white";
  })();

  return (
    <motion.li
      layout
      layoutId={`row-${score.code}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{
        layout: { type: "spring", stiffness: 320, damping: 30 },
        opacity: { duration: 0.25 },
      }}
      className="relative list-card-hover glass-card rounded-2xl px-3 py-2.5 flex items-center gap-3"
    >
      <motion.div
        layout="position"
        className={`shrink-0 h-8 w-8 rounded-full flex items-center justify-center font-display text-sm ${badge}`}
      >
        {index + 1}
      </motion.div>
      <HeartFlag code={score.code} name={score.name} size="md" />
      <div className="hidden sm:flex flex-1 min-w-0 items-center gap-1.5 overflow-hidden">
        {detail?.artist && (
          <MetaPill icon={Mic} className="truncate max-w-[12rem]">
            <span className="truncate">{detail.artist}</span>
          </MetaPill>
        )}
        {detail?.song && (
          <MetaPill icon={Music} className="truncate max-w-[14rem]">
            <span className="truncate italic">{detail.song}</span>
          </MetaPill>
        )}
      </div>
      <div className="flex-1 sm:hidden" />
      <div className="text-right shrink-0">
        <ScoreNumber value={score.totalPoints} />
        <p className="text-[10px] uppercase tracking-widest text-white/40">
          pts
        </p>
      </div>

      <AnimatePresence>
        {delta !== undefined && delta !== 0 && (
          <motion.span
            key="delta"
            initial={{ opacity: 0, scale: 0.4, y: 0 }}
            animate={{ opacity: 1, scale: 1, y: -28 }}
            exit={{ opacity: 0, y: -48 }}
            transition={{ type: "spring", stiffness: 320, damping: 22 }}
            className={`absolute -top-1 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full
                        text-xs font-display tabular-nums shadow-lg
                        ${delta > 0 ? "bg-success text-black" : "bg-error text-white"}`}
          >
            {delta > 0 ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            {delta > 0 ? `+${delta}` : delta}
          </motion.span>
        )}
      </AnimatePresence>

      {/* Live "+N" point pops: each one floats up off the score number
          when somebody else's vote bumps this country's total. Fan
          out horizontally so simultaneous bumps don't stack on top. */}
      <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
        <AnimatePresence>
          {(pops ?? []).map((p, i) => (
            <motion.span
              key={p.id}
              initial={{ opacity: 0, y: 0, scale: 0.6 }}
              animate={{
                opacity: [0, 1, 1, 0],
                y: -56,
                scale: 1.1,
                x: (i - (pops!.length - 1) / 2) * 6,
              }}
              exit={{ opacity: 0 }}
              transition={{
                duration: 1.5,
                ease: [0.2, 0.7, 0.3, 1],
                opacity: { times: [0, 0.15, 0.7, 1] },
              }}
              className="absolute right-0 top-0 font-display text-lg tabular-nums
                         text-gold drop-shadow-[0_0_6px_rgba(255,208,90,0.6)]"
            >
              +{p.delta}
            </motion.span>
          ))}
        </AnimatePresence>
      </div>
    </motion.li>
  );
}

function ScoreNumber({ value }: { value: number }) {
  return (
    <motion.p
      key={value}
      initial={{ scale: 1.4, color: "oklch(78.49% 0.135563 189.949)" }}
      animate={{ scale: 1, color: "oklch(70.55% 0.2725 336.19)" }}
      transition={{
        type: "spring",
        stiffness: 360,
        damping: 18,
        color: { duration: 0.6 },
      }}
      className="font-display text-2xl tabular-nums leading-none origin-right"
    >
      {value}
    </motion.p>
  );
}
