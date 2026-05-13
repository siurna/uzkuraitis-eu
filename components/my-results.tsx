"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import { Trophy } from "lucide-react";
import { useEventListener } from "@/lib/liveblocks";
import { useRoomLive, useRoomTab } from "@/components/room-shell";
import { ensureSessionId } from "@/lib/use-identity";
import type { BetBreakdown } from "@/lib/scoring";
import { useLang, t } from "@/lib/i18n";

type Row = {
  sessionId: string;
  name: string;
  topTen: number;
  home: number;
  bets: BetBreakdown;
  highlights: number;
  total: number;
};

// Home banner: once results are tallied, shows YOUR rank + total. Tap
// jumps to the Results tab (the former Vote tab, swapped in by
// RoomTabBar) where the full breakdown + leaderboard live. Hidden if
// results aren't in yet.
export function MyResults() {
  const { code, tallyEnabled } = useRoomLive();
  const { setTab } = useRoomTab();
  const lang = useLang();
  const [rows, setRows] = useState<Row[] | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/rooms/${code}/leaderboard`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { hasResults: boolean; leaderboard: Row[] };
      if (data.hasResults) setRows(data.leaderboard);
    } catch {
      /* network blip */
    }
  }, [code]);

  useEffect(() => {
    if (tallyEnabled) load();
  }, [tallyEnabled, load]);

  useEventListener(({ event }) => {
    if ((event as { type?: string }).type === "leaderboard:updated") load();
  });

  if (!tallyEnabled || !rows || rows.length === 0) return null;
  const session = ensureSessionId();
  const idx = rows.findIndex((r) => r.sessionId === session);
  const me = idx >= 0 ? rows[idx] : null;
  const rank = idx >= 0 ? idx + 1 : 0;
  const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;

  return (
    <div id="my-results" className="container mx-auto max-w-3xl px-4 scroll-mt-16">
      <motion.button
        type="button"
        onClick={() => setTab("vote")}
        initial={{ opacity: 0, y: 12, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 360, damping: 32 }}
        className="relative block w-full overflow-hidden rounded-3xl text-left"
        style={{ background: "linear-gradient(135deg, #f5a302 0%, #d61570 48%, #4c0a54 100%)" }}
      >
        {/* podium artwork bleeding off the right — middle block tallest */}
        <div className="pointer-events-none absolute inset-y-0 -right-4 flex items-end gap-1.5 pb-6 opacity-90">
          {[
            { h: "h-12", e: "🥈", c: "bg-white/35", t: rank === 2 },
            { h: "h-[5.25rem]", e: "🥇", c: "bg-yellow", t: rank === 1 },
            { h: "h-9", e: "🥉", c: "bg-white/25", t: rank === 3 },
          ].map(({ h, e, c, t: hi }, i) => (
            <span key={i} className="flex flex-col items-center gap-1">
              <span className={`text-base ${hi ? "" : "opacity-40 grayscale"}`}>{e}</span>
              <span className={`w-7 rounded-t-md ${h} ${c} ${hi ? "ring-2 ring-white/60" : ""}`} />
            </span>
          ))}
        </div>
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "linear-gradient(95deg, rgba(8,9,28,0.42) 0%, rgba(8,9,28,0.15) 42%, transparent 64%)" }}
        />
        <div className="relative flex items-center gap-3 px-5 py-5 min-h-[7rem]">
          <span className="shrink-0 grid place-items-center h-14 w-14 rounded-2xl bg-white/15 ring-1 ring-white/25 text-2xl font-display text-white drop-shadow-sm">
            {me ? (medal ?? `#${rank}`) : "🏆"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-[0.3em] text-white/75 font-display leading-tight mb-1 flex items-center gap-1.5">
              <Trophy className="h-3 w-3" />
              {t(lang, me ? "home_my_results" : "home_results_in")}
            </p>
            {me ? (
              <>
                <p className="font-display text-xl text-white truncate leading-tight drop-shadow-sm">{me.name}</p>
                <p className="text-sm text-white/70 leading-snug mt-0.5">
                  {t(lang, "home_my_results_rank", rank, rows.length)}
                </p>
              </>
            ) : (
              <p className="text-sm text-white/70 leading-snug mt-0.5">{t(lang, "home_results_in_sub")}</p>
            )}
          </div>
          {me && (
            <span className="relative text-right shrink-0 pr-1">
              <span className="block font-display text-3xl text-white tabular-nums leading-none drop-shadow">{me.total}</span>
              <span className="block text-[10px] uppercase tracking-wider text-white/60 mt-0.5">{t(lang, "pts_short")}</span>
            </span>
          )}
        </div>
      </motion.button>
    </div>
  );
}
