"use client";

import { motion } from "motion/react";
import { useRoomLive, useRoomTab } from "@/components/room-shell";
import { useLeaderboard } from "@/components/leaderboard-provider";
import { FluentEmoji } from "@/components/fluent-emoji";
import { ensureSessionId } from "@/lib/use-identity";
import { totalBetPoints } from "@/lib/scoring";
import { t } from "@/lib/i18n";
import { useLang } from "@/lib/i18n-client";

// Home banner: once results are tallied, shows YOUR card — a big rank
// + total in a vertical layout, with a row of breakdown chips below
// (TOP10 / Home / Bets / Highlights). Tap = jump to the Results tab
// for the full breakdown + leaderboard. Hidden if results aren't in yet.
//
// The per-bet "you said / it was" comparison used to render inside
// this banner too — it's gone from here so the home card stays
// scannable; the chips below the total carry the breakdown signal,
// the full comparison lives one tap away in the Results tab.
export function MyResults() {
  const { tallyEnabled } = useRoomLive();
  const { setTab } = useRoomTab();
  const lang = useLang();
  const { payload } = useLeaderboard();

  if (!tallyEnabled || !payload || payload.leaderboard.length === 0) return null;
  const rows = payload.leaderboard;
  const session = ensureSessionId();
  const idx = rows.findIndex((r) => r.sessionId === session);
  const me = idx >= 0 ? rows[idx] : null;
  const rank = idx >= 0 ? idx + 1 : 0;
  const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
  const betsTotal = me ? totalBetPoints(me.bets) : 0;

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
          // Cooler trophy gradient (gold > turquoise > deep navy) so the
          // results card doesn't collide with the pink-flamingo Vote
          // hero or the orange-fire Highlights card stacked above it.
          // Three distinct palette families on Home reads as variety
          // instead of "everything is pink".
          background: "linear-gradient(155deg, #f5a302 0%, #00b8b0 48%, #0a2c4a 100%)",
        }}
      >
        {/* Top gloss — gives the card a polished, skeumorphic top edge. */}
        <span
          className="pointer-events-none absolute inset-x-0 top-0 h-1/3"
          style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.20), transparent)" }}
          aria-hidden
        />
        <div className="relative flex flex-col p-5">
          {/* Eyebrow + name */}
          <header className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.3em] text-white/80 font-display leading-tight">
                {t(lang, me ? "home_my_results" : "home_results_in")}
              </p>
              {me ? (
                <p className="font-display text-base text-white/95 truncate leading-tight mt-0.5">
                  {me.name}
                </p>
              ) : (
                <p className="text-xs text-white/70 leading-snug mt-0.5">
                  {t(lang, "home_results_in_sub")}
                </p>
              )}
            </div>
            {me && (
              <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-white/18 ring-1 ring-white/30 px-3 h-7 text-sm text-white font-display tabular-nums">
                {medal ? (
                  <FluentEmoji glyph={medal} size={16} ariaLabel={`rank ${rank}`} />
                ) : (
                  <span>#{rank}</span>
                )}
                <span className="text-white/70 text-xs">
                  / {rows.length}
                </span>
              </span>
            )}
          </header>

          {me ? (
            <>
              {/* Total — the showpiece number, centred so it carries
                  the card. Negative margin-top pulls the score up into
                  the header band so the visually-empty strip between
                  the eyebrow and the score disappears (the rank pill
                  on the right and the number on the left share the
                  same vertical band now). The compensating pb on the
                  chips below restores breathing room at the bottom. */}
              <div className="flex items-baseline gap-2 justify-center -mt-3 sm:-mt-4">
                <span
                  className="font-display tabular-nums leading-none text-white drop-shadow"
                  style={{ fontSize: "clamp(3.25rem, 14vw, 5rem)" }}
                >
                  {me.total}
                </span>
                <span className="text-base font-display text-white/75 tracking-wider uppercase">
                  {t(lang, "pts_short")}
                </span>
              </div>

              {/* Breakdown chips — quick read of where the points came
                  from. Zero-value categories stay hidden to avoid noise. */}
              <ul className="flex flex-wrap items-center justify-center gap-1.5 text-[12px] pt-3 pb-1">
                {me.topTen > 0 && <Chip label={t(lang, "breakdown_top_ten")} value={`+${me.topTen}`} />}
                {me.home > 0 && <Chip label={t(lang, "breakdown_home")} value={`+${me.home}`} />}
                {betsTotal > 0 && <Chip label={t(lang, "breakdown_bets_sum")} value={`+${betsTotal}`} />}
                {me.highlights > 0 && (
                  <Chip label={t(lang, "breakdown_highlights")} value={`+${me.highlights}`} />
                )}
                {me.trivia > 0 && (
                  <Chip label={t(lang, "trivia_eyebrow")} value={`+${me.trivia}`} />
                )}
              </ul>

            </>
          ) : null}
        </div>
      </motion.button>
    </div>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <li className="inline-flex items-center gap-1 rounded-full bg-white/15 ring-1 ring-white/22 px-2.5 h-7 text-white/90 font-display">
      <span className="text-white/70">{label}</span>
      <span className="tabular-nums text-white">{value}</span>
    </li>
  );
}
