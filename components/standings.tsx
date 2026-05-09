"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, Loader2, RefreshCw } from "lucide-react";
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
  const [refreshing, setRefreshing] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);

  const fetchScores = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/rooms/${code}/scores`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as ScoresResponse;
      setScores(data.scores);
      setVoters(data.voters);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [code]);

  useEffect(() => {
    fetchScores();
  }, [fetchScores]);

  // Liveblocks broadcasts a "scores changed" hint after a vote is submitted.
  // We refetch on that hint instead of polling.
  useEventListener(({ event }) => {
    if ((event as { type?: string }).type === "country") {
      // reactions don't change scores; ignore
      return;
    }
  });

  // Light polling fallback (every 30s — still better than the old 10s firehose)
  // since real-time score sync goes through the Liveblocks "scores" event.
  useEffect(() => {
    const id = setInterval(fetchScores, 30000);
    return () => clearInterval(id);
  }, [fetchScores]);

  useEffect(() => {
    const stored = localStorage.getItem(`uzk_voted_${code}`);
    setHasVoted(stored === "1");
  }, [code]);

  const allWithZero = (() => {
    const map = new Map(scores.map((s) => [s.code, s]));
    return countries
      .map((c) => map.get(c.code) ?? {
        code: c.code, name: c.name, flag: c.flag,
        totalPoints: 0, points12: 0, points10: 0,
      })
      .sort((a, b) => {
        if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
        return (getCountry(a.code)?.order ?? 999) - (getCountry(b.code)?.order ?? 999);
      });
  })();

  const visible = showAll ? allWithZero : scores.slice(0, 5);

  return (
    <main className="container mx-auto max-w-3xl px-4 py-6 flex-1 flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-3xl sm:text-4xl font-display gradient-text">
            Standings
          </h2>
          <button
            onClick={fetchScores}
            disabled={refreshing}
            aria-label="Refresh scores"
            className="text-white/40 hover:text-white transition"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-10 w-10 animate-spin text-flamingo" />
          </div>
        ) : visible.length === 0 ? (
          <div className="glass-card rounded-xl p-8 text-center text-white/60 font-display">
            No votes yet — be the first.
          </div>
        ) : (
          <ol className="flex flex-col gap-2 country-list-container">
            {visible.map((s, i) => (
              <CountryRow key={s.code} score={s} index={i} />
            ))}
          </ol>
        )}

        {scores.length > 0 && (
          <Button
            variant="ghost"
            onClick={() => setShowAll((v) => !v)}
            className="mt-1 text-flamingo hover:text-flamingo/80 font-display"
          >
            {showAll ? (
              <><ChevronUp className="h-4 w-4 mr-2" /> Top 5 only</>
            ) : (
              <><ChevronDown className="h-4 w-4 mr-2" /> Show all {countries.length}</>
            )}
          </Button>
        )}
      </section>

      {voters.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="text-2xl font-display gradient-text">Votes cast</h3>
          <div className="flex flex-wrap gap-2 justify-center">
            {voters.map((v) => {
              const top = v.votes["12"] ? getCountry(v.votes["12"]) : null;
              return (
                <span
                  key={v.id}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm
                             bg-gradient-to-r from-flamingo/30 to-turquoise/20 border border-white/10"
                >
                  {top && <Flag code={top.code} size="sm" />}
                  {v.name}
                </span>
              );
            })}
          </div>
        </section>
      )}

      <div className="fixed bottom-0 left-0 right-0 z-20 bg-dark-blue-900/85 backdrop-blur-md border-t border-white/5 py-3">
        <div className="container mx-auto max-w-3xl px-4">
          <Link href={`/r/${code}/vote`} className="block">
            <Button
              disabled={!votingEnabled}
              className={`w-full h-14 text-lg font-display
                bg-gradient-to-r from-flamingo via-fuchsia to-turquoise
                hover:opacity-90 disabled:opacity-40
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
}: {
  score: ScoreRow;
  index: number;
}) {
  const detail = getCountry(score.code);
  const badge = (() => {
    if (index === 0) return "bg-gold text-black";
    if (index === 1) return "bg-white/80 text-black";
    if (index === 2) return "bg-orange text-black";
    return "bg-flamingo/80 text-white";
  })();

  return (
    <li
      className="glass-card rounded-xl p-3 flex items-center gap-3 country-item"
      style={{ ["--index" as string]: index }}
    >
      <div
        className={`shrink-0 h-10 w-10 rounded-full flex items-center justify-center font-display text-base ${badge}`}
      >
        {index + 1}
      </div>
      <Flag code={score.code} size="row" alt={`${score.name} flag`} />
      <div className="flex-1 min-w-0">
        <p className="font-display text-lg truncate">{score.name}</p>
        {detail && (detail.artist || detail.song) && (
          <p className="text-xs text-white/55 truncate">
            {detail.artist} — <span className="italic">{detail.song}</span>
          </p>
        )}
      </div>
      <div className="text-right">
        <p className="font-display text-2xl text-flamingo tabular-nums leading-none">
          {score.totalPoints}
        </p>
        <p className="text-[10px] uppercase tracking-widest text-white/40">pts</p>
      </div>
    </li>
  );
}
