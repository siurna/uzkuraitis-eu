"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Crown, Trophy } from "lucide-react";
import { useEventListener } from "@/lib/liveblocks";
import { getCountry } from "@/lib/countries";
import { Flag } from "@/components/flag";

type Row = {
  voterId: string;
  name: string;
  homePrediction: number | null;
  topTen: number;
  home: number;
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
export function Leaderboard({ code }: { code: string }) {
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(true);

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

  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-center gap-2">
        <Trophy className="h-5 w-5 text-gold" />
        <h3 className="text-2xl font-display gradient-text">Leaderboard</h3>
        {home && homeCountryOfficialPlacement != null && (
          <span className="ml-auto text-xs text-white/50 inline-flex items-center gap-1.5">
            <Flag code={home.code} size="sm" />
            finished {homeCountryOfficialPlacement}
          </span>
        )}
      </header>

      <ol className="flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {leaderboard.map((row, i) => (
            <motion.li
              key={row.voterId}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{
                layout: { type: "spring", stiffness: 320, damping: 30 },
              }}
              className="list-entry-gradient list-card-hover glass-card rounded-xl p-3 flex items-center gap-3"
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
                <p className="text-xs text-white/55">
                  {row.topTen} ballot
                  {row.home > 0 && <> + {row.home} {home?.name ?? "home"}</>}
                  {row.betsTotal > 0 && <> + {row.betsTotal} bonuses</>}
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
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
    </section>
  );
}
