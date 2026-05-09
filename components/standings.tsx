"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence, LayoutGroup } from "motion/react";
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { countries, getCountry } from "@/lib/countries";
import { useEventListener } from "@/lib/liveblocks";
import { Flag } from "@/components/flag";

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

export function Standings({
  code,
  votingEnabled,
}: {
  code: string;
  votingEnabled: boolean;
}) {
  const [scores, setScores] = useState<ScoreRow[]>([]);
  const [voters, setVoters] = useState<VoterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);

  const prevRanks = useRef<Map<string, number>>(new Map());
  const [rankDeltas, setRankDeltas] = useState<Record<string, number>>({});

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

  // Initial load.
  useEffect(() => {
    fetchScores();
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
    const deltas: Record<string, number> = {};
    visible.forEach((row, i) => {
      const prev = prevRanks.current.get(row.code);
      if (prev !== undefined && prev !== i) deltas[row.code] = prev - i;
    });
    if (Object.keys(deltas).length > 0) {
      setRankDeltas(deltas);
      const t = setTimeout(() => setRankDeltas({}), 2400);
      visible.forEach((row, i) => prevRanks.current.set(row.code, i));
      return () => clearTimeout(t);
    }
    visible.forEach((row, i) => prevRanks.current.set(row.code, i));
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
            No votes yet, be the first.
          </motion.div>
        ) : (
          <LayoutGroup>
            <motion.ol layout className="flex flex-col gap-2">
              <AnimatePresence initial={false}>
                {visible.map((s, i) => (
                  <CountryRow
                    key={s.code}
                    score={s}
                    index={i}
                    delta={rankDeltas[s.code]}
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
                <ChevronUp className="h-4 w-4 mr-2" /> Top 5 only
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-2" /> Show all{" "}
                {countries.length}
              </>
            )}
          </Button>
        )}
      </section>

      {voters.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="text-2xl font-display gradient-text">Votes cast</h3>
          <div className="flex flex-wrap gap-2 justify-center">
            <AnimatePresence initial={false}>
              {voters.map((v) => {
                const top = v.votes["12"] ? getCountry(v.votes["12"]) : null;
                return (
                  <motion.span
                    key={v.id}
                    layout
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.6 }}
                    transition={{
                      type: "spring",
                      stiffness: 400,
                      damping: 24,
                    }}
                    className="inline-flex items-center gap-2 pl-1 pr-3 py-1 rounded-full text-sm
                               bg-gradient-to-r from-flamingo/30 to-turquoise/20 border border-white/10"
                  >
                    {top && <Flag code={top.code} size="sm" />}
                    {v.name}
                  </motion.span>
                );
              })}
            </AnimatePresence>
          </div>
        </section>
      )}

      <div className="fixed bottom-0 left-0 right-0 z-20 bg-dark-blue-900/85 backdrop-blur-md border-t border-white/5 py-3">
        <div className="container mx-auto max-w-3xl px-4">
          <Link href={`/r/${code}/vote`} className="block">
            <Button
              disabled={!votingEnabled}
              className={`w-full h-14 text-lg font-display
                bg-gradient-to-r from-gold via-flamingo to-purple
                hover:opacity-95 disabled:opacity-40
                ${hasVoted ? "update-pulse-button" : "cast-pulse-button"}`}
            >
              {!votingEnabled
                ? "Voting closed"
                : hasVoted
                  ? "Update your vote"
                  : "Cast your vote"}
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}

function CountryRow({
  score,
  index,
  delta,
}: {
  score: ScoreRow;
  index: number;
  delta?: number;
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
      className="relative list-entry-gradient glass-card rounded-xl p-3 flex items-center gap-3"
    >
      <motion.div
        layout="position"
        className={`shrink-0 h-10 w-10 rounded-full flex items-center justify-center font-display text-base ${badge}`}
      >
        {index + 1}
      </motion.div>
      <Flag code={score.code} size="row" alt={`${score.name} flag`} />
      <div className="flex-1 min-w-0">
        <p className="font-display text-lg truncate">{score.name}</p>
        {detail && (detail.artist || detail.song) && (
          <p className="text-xs text-white/55 truncate">
            {detail.artist}, <span className="italic">{detail.song}</span>
          </p>
        )}
      </div>
      <div className="text-right">
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
