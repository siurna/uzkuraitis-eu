"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence, LayoutGroup } from "motion/react";
import {
  ChevronDown,
  ChevronUp,
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
          // Skeleton rows match the real CountryRow shape so the layout
          // doesn't jump when scores arrive. No spinner.
          <ul className="flex flex-col gap-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <li
                key={i}
                className="glass-card rounded-2xl px-3 py-2.5 flex items-center gap-3 opacity-60"
              >
                <span className="h-9 w-9 rounded-full bg-white/8 animate-pulse" />
                <span className="h-7 w-24 rounded-full bg-white/8 animate-pulse" />
                <span className="flex-1" />
                <span className="h-7 w-10 rounded-md bg-white/8 animate-pulse" />
              </li>
            ))}
          </ul>
        ) : visible.length === 0 ? (
          <NoVotesYet code={code} votingEnabled={votingEnabled} lang={lang} hasVoted={hasVoted} />
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
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="self-center mt-1 px-4 h-9 rounded-full font-display text-sm
                       text-white/80 hover:text-white
                       bg-white/5 hover:bg-white/10
                       ring-1 ring-white/10 hover:ring-white/25
                       transition flex items-center gap-1.5"
          >
            {showAll ? (
              <>
                <ChevronUp className="h-4 w-4" /> {t(lang, "show_top_5")}
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" /> {t(lang, "show_all")}{" "}
                {countries.length}
              </>
            )}
          </button>
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

function NoVotesYet({
  code,
  votingEnabled,
  lang,
  hasVoted,
}: {
  code: string;
  votingEnabled: boolean;
  lang: "en" | "lt";
  hasVoted: boolean;
}) {
  // Three placeholder rows hint at the standings shape so the layout
  // doesn't visually empty out before the first vote lands.
  const placeholders = [0, 1, 2];
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col gap-5 py-6"
    >
      <div className="flex flex-col items-center text-center gap-3">
        <motion.div
          animate={{ scale: [1, 1.18, 1, 1.1, 1] }}
          transition={{
            duration: 1.1,
            times: [0, 0.18, 0.36, 0.5, 1],
            repeat: Infinity,
            repeatDelay: 0.5,
            ease: "easeInOut",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/70-heart.webp"
            alt=""
            className="h-20 w-20 object-contain drop-shadow-[0_0_24px_rgba(255,46,222,0.35)]"
          />
        </motion.div>
        <h3 className="font-display text-2xl text-white/90">
          {t(lang, "no_votes_yet")}
        </h3>
        <p className="text-sm text-white/50 max-w-xs">
          {t(lang, "no_votes_sub")}
        </p>
      </div>

      {/* Ghost rows: hint at the standings shape so the page doesn't
          look empty before the first vote lands. */}
      <ul className="flex flex-col gap-2">
        {placeholders.map((i) => (
          <motion.li
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 + i * 0.08, duration: 0.4 }}
            className="glass-card rounded-2xl px-3 py-2.5 flex items-center gap-3
                       opacity-50"
          >
            <span className="h-9 w-9 rounded-full bg-white/8" />
            <span className="h-7 flex-1 max-w-[8rem] rounded-full bg-white/8" />
            <span className="h-6 w-8 rounded-md bg-white/8" />
          </motion.li>
        ))}
      </ul>

      {votingEnabled && (
        <Link
          href={`/r/${code}/vote`}
          className="rainbow-border rounded-2xl mx-auto w-full max-w-xs"
        >
          <Button
            className="w-full h-12 text-base font-display rounded-[14px]
                       bg-white text-dark-blue hover:bg-dark-blue-50"
          >
            {hasVoted ? t(lang, "update_vote") : t(lang, "be_the_first")}
          </Button>
        </Link>
      )}
    </motion.div>
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
  // Top-3 get a richer treatment: bigger row padding, gold/silver/bronze
  // ring + brand glow, and the score in the brand colour. Keeps the
  // ordered list semantic but lets the eye land on the podium fast.
  const podium =
    index === 0
      ? "ring-2 ring-yellow shadow-[0_0_24px_-8px_oklch(95%_0.19_108_/_0.65)]"
      : index === 1
        ? "ring-2 ring-white/70 shadow-[0_0_18px_-10px_rgba(255,255,255,0.55)]"
        : index === 2
          ? "ring-2 ring-orange shadow-[0_0_18px_-10px_oklch(70%_0.19_42_/_0.6)]"
          : "";
  const scoreColor =
    index === 0 ? "oklch(95% 0.19 108)"
      : index === 1 ? "oklch(98% 0 0)"
        : index === 2 ? "oklch(70% 0.19 42)"
          : "oklch(70.55% 0.2725 336.19)";

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
      className={`relative list-card-hover glass-card rounded-2xl flex items-center gap-3
                  ${index < 3 ? "px-3.5 py-3.5" : "px-3 py-2.5"} ${podium}`}
    >
      <HeartFlag
        code={score.code}
        name={score.name}
        size={index === 0 ? "lg" : "md"}
      />
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
      <div className="shrink-0">
        <ScoreNumber value={score.totalPoints} color={scoreColor} />
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

function ScoreNumber({
  value,
  color = "oklch(70.55% 0.2725 336.19)",
}: {
  value: number;
  color?: string;
}) {
  return (
    <motion.p
      key={value}
      initial={{ scale: 1.4, color: "oklch(78.49% 0.135563 189.949)" }}
      animate={{ scale: 1, color }}
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
