"use client";

import { motion } from "motion/react";
import { useRoomLive, useRoomTab } from "@/components/room-shell";
import { useLeaderboard } from "@/components/leaderboard-provider";
import { FluentEmoji } from "@/components/fluent-emoji";
import { ensureSessionId } from "@/lib/use-identity";
import { t } from "@/lib/i18n";
import { useLang } from "@/lib/i18n-client";

// Home banner that lands once results are tallied. Renders the room's
// TOP 5 voters as a Eurovision-jury-reveal-style "scoreboard tape" —
// rank medal, name, a thin bar whose width tracks each voter's score
// relative to #1, total points right-aligned. Rows drop in staggered
// so the eye reads "1st… 2nd… 3rd…" the way the broadcast spokesperson
// would announce them. The viewer's own row glows when they're in the
// top 5; if they're not, a small "you: #N · X pts" footer pins them
// to the rest of the field. Tapping the card opens the full Results
// tab. Hidden until tallyEnabled flips on the room.
const TOP_N = 5;

export function MyResults() {
  const { tallyEnabled } = useRoomLive();
  const { setTab } = useRoomTab();
  const lang = useLang();
  const { payload } = useLeaderboard();

  if (!tallyEnabled || !payload || payload.leaderboard.length === 0) return null;
  const rows = payload.leaderboard;
  const session = ensureSessionId();
  const myIdx = rows.findIndex((r) => r.sessionId === session);
  const myRank = myIdx >= 0 ? myIdx + 1 : 0;
  const me = myIdx >= 0 ? rows[myIdx] : null;
  const top = rows.slice(0, TOP_N);
  const meInTop = myIdx >= 0 && myIdx < TOP_N;
  // Bars scale to #1's score — so the leader fills the bar and the
  // rest read as "this much of the leader's run." Floor at 8% so
  // even a 0-pt row leaves a visible sliver (the rank still matters
  // even when the score doesn't).
  const topScore = Math.max(1, top[0]?.total ?? 1);
  const widthFor = (n: number) =>
    `${Math.max(8, Math.min(100, (n / topScore) * 100))}%`;

  return (
    <div id="my-results" className="scroll-mt-16">
      <motion.button
        type="button"
        onClick={() => setTab("vote")}
        initial={{ opacity: 0, y: 12, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 360, damping: 32 }}
        className="relative block w-full overflow-hidden rounded-3xl text-left
                   ring-1 ring-white/10
                   shadow-[0_20px_60px_-22px_oklch(45%_0.18_345_/_0.55),inset_0_1px_0_rgba(255,255,255,0.18)]"
        style={{
          // Trophy gradient (gold → turquoise → deep navy) — matches
          // the prior treatment so the widget reads as the same card
          // the viewer's been seeing through the night, just with
          // new contents now that the show is over.
          background: "linear-gradient(155deg, #f5a302 0%, #00b8b0 48%, #0a2c4a 100%)",
        }}
      >
        {/* Top gloss for the polished, skeumorphic top edge. */}
        <span
          className="pointer-events-none absolute inset-x-0 top-0 h-1/3"
          style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.20), transparent)" }}
          aria-hidden
        />

        <div className="relative flex flex-col p-5 gap-3">
          {/* Header: eyebrow + total-voter count chip on the right. */}
          <header className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.3em] text-white/85 font-display leading-tight">
                {t(lang, "home_results_in")}
              </p>
              <p className="font-display text-lg text-white leading-tight mt-0.5">
                {t(lang, "results_top5")}
              </p>
            </div>
            <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-white/15 ring-1 ring-white/25 px-2.5 h-7 text-[11px] text-white/90 font-display tabular-nums">
              {rows.length} {t(lang, "results_voters")}
            </span>
          </header>

          {/* Scoreboard tape — one row per top-5 voter. */}
          <ol className="flex flex-col gap-2 mt-1">
            {top.map((row, i) => {
              const rank = i + 1;
              const isMe = row.sessionId === session;
              return (
                <ScoreRow
                  key={row.sessionId}
                  rank={rank}
                  name={row.name}
                  total={row.total}
                  width={widthFor(row.total)}
                  isMe={isMe}
                  delay={i * 0.08}
                />
              );
            })}
          </ol>

          {/* If you placed outside the top 5, the footer pins your
              row to the bottom so the card never reads as "you don't
              matter, here's the leaderboard." */}
          {!meInTop && me && (
            <div className="mt-1 flex items-center gap-2 rounded-xl bg-white/10 ring-1 ring-white/18 px-3 py-2">
              <span className="text-[10px] uppercase tracking-[0.22em] text-white/70 font-display">
                {t(lang, "results_you_label")}
              </span>
              <span className="text-sm text-white font-display tabular-nums">
                #{myRank}
              </span>
              <span className="text-white/55">·</span>
              <span className="flex-1 truncate text-sm text-white/85 font-display">
                {me.name}
              </span>
              <span className="shrink-0 text-sm text-white font-display tabular-nums">
                {me.total} {t(lang, "pts_short")}
              </span>
            </div>
          )}
        </div>
      </motion.button>
    </div>
  );
}

function ScoreRow({
  rank,
  name,
  total,
  width,
  isMe,
  delay,
}: {
  rank: number;
  name: string;
  total: number;
  width: string;
  isMe: boolean;
  delay: number;
}) {
  const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
  return (
    <motion.li
      // Each row drops in from the left with a small stagger — feels
      // like the spokesperson reading "Twelve points go to…", not a
      // grid that all materialises at once.
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className={`relative rounded-xl px-2.5 py-1.5 flex items-center gap-2.5 transition
                  ${isMe
                    ? "bg-white/22 ring-1 ring-white/40 shadow-[0_0_16px_-4px_rgba(255,255,255,0.45)]"
                    : "bg-white/[0.06] ring-1 ring-white/12"}`}
    >
      {/* Rank chip — medal emoji for 1-3, plain numeral for 4-5. */}
      <span className="shrink-0 grid place-items-center h-7 w-7 rounded-full bg-black/30 ring-1 ring-white/15 text-sm font-display tabular-nums text-white">
        {medal ? <FluentEmoji glyph={medal} size={18} ariaLabel={`rank ${rank}`} /> : rank}
      </span>
      {/* Name + bar share the middle column. The bar grows from 0 to
          its width on row mount so the leader's bar visibly extends
          first and the rest shorten away from it. */}
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <span className="text-sm font-display text-white truncate leading-tight">
          {name}
        </span>
        <span className="relative h-1 rounded-full bg-black/35 overflow-hidden">
          <motion.span
            initial={{ width: 0 }}
            animate={{ width }}
            transition={{ delay: delay + 0.18, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              background: isMe
                ? "linear-gradient(90deg, #ffffff, #ffe9b5)"
                : "linear-gradient(90deg, #f5a302, #ffe9b5)",
            }}
          />
        </span>
      </div>
      <span className="shrink-0 text-base font-display text-white tabular-nums">
        {total}
      </span>
    </motion.li>
  );
}
