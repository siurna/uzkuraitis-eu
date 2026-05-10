"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, X } from "lucide-react";
import type { BetBreakdown } from "@/lib/scoring";
import { useParticles } from "@/components/particle-layer";
import { useLang, t } from "@/lib/i18n";

// End-of-show reveal. Once admin enters the official result + flips
// tallyEnabled, the voter can tap "Reveal my night" on the home tab.
// We portal a full-screen overlay over everything, walk the user
// through their bet-by-bet breakdown in order, popping points and
// firing a heart particle on each card. Final card is their grand
// total. Built around the existing leaderboard breakdown data — no
// new fetches needed.

type RevealRow = {
  voterId: string;
  name: string;
  topTen: number;
  home: number;
  bets: BetBreakdown;
  total: number;
};

const STEP_MS = 2200;

export function ResultsReveal({
  row,
  homeName,
  open,
  onClose,
}: {
  row: RevealRow;
  homeName: string;
  open: boolean;
  onClose: () => void;
}) {
  const lang = useLang();
  const particles = useParticles();
  const [step, setStep] = useState(0);
  const [mounted, setMounted] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setMounted(true), []);

  // One row per scoring component plus a final-total card.
  const cards = useMemo(() => {
    const lines: { label: string; pts: number }[] = [
      { label: t(lang, "reveal_top10"), pts: row.topTen },
      { label: t(lang, "reveal_home", homeName), pts: row.home },
      { label: t(lang, "reveal_home_total", homeName), pts: row.bets.ltTotalPoints },
      { label: t(lang, "reveal_wooden"), pts: row.bets.woodenSpoon },
      { label: t(lang, "reveal_lt12to", homeName), pts: row.bets.lt12To },
      { label: t(lang, "reveal_big5"), pts: row.bets.highestBig5 },
      { label: t(lang, "reveal_jury"), pts: row.bets.juryWinner },
      { label: t(lang, "reveal_tele"), pts: row.bets.televoteWinner },
      { label: t(lang, "reveal_nul"), pts: row.bets.nulTelevote },
      { label: t(lang, "reveal_host"), pts: row.bets.hostTop3 },
      { label: t(lang, "reveal_solo"), pts: row.bets.winnerSolo },
    ];
    return lines;
  }, [row, homeName, lang]);

  // Auto-advance through cards. Last index = total card.
  useEffect(() => {
    if (!open) {
      setStep(0);
      return;
    }
    if (step > cards.length) return;
    timer.current = setTimeout(() => {
      setStep((s) => s + 1);
      // Heart particle per advance.
      if (step <= cards.length - 1) {
        const x = window.innerWidth / 2;
        const y = window.innerHeight * 0.45;
        particles.spawn({
          asset: { type: "image", src: "/images/70-heart.webp" },
          from: { x, y },
          size: 80,
          driftRange: 220,
          durationMs: 1500,
          rotate: 24,
        });
      }
    }, STEP_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [step, open, cards.length, particles]);

  if (!mounted || typeof document === "undefined") return null;

  const showingTotal = step >= cards.length;
  const current = !showingTotal ? cards[step] : null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="reveal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.32 }}
          className="fixed inset-0 z-[80] bg-dark-blue-900/92 backdrop-blur-md
                     flex flex-col items-center justify-center px-6"
        >
          <button
            type="button"
            onClick={onClose}
            aria-label={t(lang, "cancel")}
            className="absolute top-4 right-4 h-9 w-9 rounded-full grid place-items-center
                       bg-white/[0.08] ring-1 ring-white/15 text-white/60 hover:text-white transition"
          >
            <X className="h-4 w-4" />
          </button>

          <header className="text-center mb-8 flex flex-col items-center gap-2">
            <Sparkles className="h-5 w-5 text-flamingo" />
            <p className="text-xs uppercase tracking-[0.32em] text-white/55 font-display">
              {t(lang, "reveal_title")}
            </p>
            <h2 className="font-display text-2xl gradient-text">{row.name}</h2>
          </header>

          <div className="relative w-full max-w-md h-48">
            <AnimatePresence mode="wait">
              {!showingTotal && current && (
                <motion.div
                  key={`step-${step}`}
                  initial={{ opacity: 0, y: 20, scale: 0.92 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20, scale: 0.92 }}
                  transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute inset-0 flex flex-col items-center justify-center gap-4
                             rounded-3xl bg-white/[0.04] ring-1 ring-white/10 px-6 py-8"
                >
                  <p className="text-sm uppercase tracking-widest text-white/55 font-display">
                    {current.label}
                  </p>
                  <motion.p
                    initial={{ scale: 0.6 }}
                    animate={{ scale: 1 }}
                    transition={{
                      type: "spring",
                      stiffness: 320,
                      damping: 18,
                      delay: 0.2,
                    }}
                    className={`font-display text-7xl tabular-nums ${
                      current.pts > 0
                        ? "text-flamingo drop-shadow-[0_0_18px_rgba(255,46,222,0.6)]"
                        : "text-white/35"
                    }`}
                  >
                    {current.pts > 0 ? `+${current.pts}` : "0"}
                  </motion.p>
                </motion.div>
              )}
              {showingTotal && (
                <motion.div
                  key="total"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute inset-0 flex flex-col items-center justify-center gap-4
                             rounded-3xl ring-2 ring-flamingo
                             shadow-[0_0_64px_-12px_oklch(70.55%_0.2725_336.19_/_0.6)]
                             bg-flamingo/10 px-6 py-8"
                >
                  <p className="text-sm uppercase tracking-widest text-white/70 font-display">
                    {t(lang, "reveal_total")}
                  </p>
                  <motion.p
                    initial={{ scale: 0.3, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{
                      type: "spring",
                      stiffness: 280,
                      damping: 16,
                    }}
                    className="font-display text-8xl tabular-nums text-flamingo
                               drop-shadow-[0_0_28px_rgba(255,46,222,0.75)] heartbeat"
                  >
                    {row.total}
                  </motion.p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="mt-10 flex items-center gap-3">
            <div className="flex gap-1.5">
              {cards.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i < step ? "w-2 bg-flamingo" : "w-1.5 bg-white/20"
                  }`}
                />
              ))}
              <span
                className={`h-1.5 rounded-full transition-all ${
                  showingTotal ? "w-5 bg-flamingo" : "w-1.5 bg-white/20"
                }`}
              />
            </div>
          </div>

          {showingTotal && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.4 }}
              type="button"
              onClick={onClose}
              className="mt-8 px-5 h-11 rounded-2xl font-display
                         bg-white text-dark-blue hover:bg-dark-blue-50 transition"
            >
              {t(lang, "reveal_done")}
            </motion.button>
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
