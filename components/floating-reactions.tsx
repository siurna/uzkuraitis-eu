"use client";

import { useEffect, useState, type ComponentType } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Heart,
  Flame,
  Mic,
  PartyPopper,
  Star,
  Sparkles,
  type LucideProps,
} from "lucide-react";
import { useBroadcastEvent, useEventListener } from "@/lib/liveblocks";

// Apple-Watch-style reaction tiles: each "emoji" is a solid coloured
// circle with a white filled icon inside. Sending a reaction floats the
// same circle up the screen so what you tap is exactly what you see fly.
//
// Six tiles is the comfortable max on a 320px viewport with 44px tap
// targets; matches the previous emoji bar.
type ReactionDef = {
  id: string;
  Icon: ComponentType<LucideProps>;
  /** Tailwind utility class for the solid circle background. */
  bg: string;
  /** When true, render the icon with fill="currentColor" so the symbol
   *  is solid (e.g. heart, flame, star). Outline-only icons stay stroked. */
  filled?: boolean;
  label: string;
};

const REACTIONS: ReactionDef[] = [
  { id: "heart",   Icon: Heart,       bg: "bg-[#ff2d55]", filled: true,  label: "Love" },
  { id: "flame",   Icon: Flame,       bg: "bg-[#ff9500]", filled: true,  label: "Fire" },
  { id: "mic",     Icon: Mic,         bg: "bg-[#0a84ff]", filled: false, label: "Sing" },
  { id: "party",   Icon: PartyPopper, bg: "bg-[#bf5af2]", filled: false, label: "Party" },
  { id: "star",    Icon: Star,        bg: "bg-[#ffd60a]", filled: true,  label: "Star" },
  { id: "sparkle", Icon: Sparkles,    bg: "bg-[#30d158]", filled: true,  label: "Magic" },
];

const REACTION_BY_ID = new Map(REACTIONS.map((r) => [r.id, r]));

type Float = {
  id: number;
  reactionId: string;
  x: number;
  y: number;
  rotate: number;
  drift: number;
};

let nextFloatId = 1;

export function FloatingReactionsLayer({
  code,
  hideBarOnMobile = false,
  liftAboveComposer = false,
}: {
  code: string;
  /** When true (voting is open), the bottom emoji bar collapses on
   *  mobile so the sticky vote CTA owns that area. Floats keep flying. */
  hideBarOnMobile?: boolean;
  /** When true (chat tab), lift the bar above the pinned composer. */
  liftAboveComposer?: boolean;
}) {
  const [floats, setFloats] = useState<Float[]>([]);
  const broadcast = useBroadcastEvent();

  // Cap visible floats so a thousand-tap mashing session doesn't tank perf.
  useEffect(() => {
    if (floats.length > 60) {
      setFloats((prev) => prev.slice(-40));
    }
  }, [floats]);

  useEventListener(({ event }) => {
    if (event.type !== "reaction:emoji") return;
    spawn(event.emoji, event.x, event.y);
  });

  const spawn = (reactionId: string, x: number, y: number) => {
    if (!REACTION_BY_ID.has(reactionId)) return;
    setFloats((prev) => [
      ...prev,
      {
        id: nextFloatId++,
        reactionId,
        x,
        y,
        rotate: (Math.random() - 0.5) * 60,
        drift: (Math.random() - 0.5) * 220,
      },
    ]);
  };

  const send = (reactionId: string) => {
    const x = window.innerWidth / 2 + (Math.random() - 0.5) * 80;
    const y = window.innerHeight - 120;
    broadcast({ type: "reaction:emoji", emoji: reactionId, x, y });
    spawn(reactionId, x, y);
    if ("vibrate" in navigator) navigator.vibrate?.(8);
  };

  return (
    <>
      <div className="fixed inset-0 z-40 pointer-events-none overflow-hidden">
        <AnimatePresence>
          {floats.map((f) => {
            const def = REACTION_BY_ID.get(f.reactionId);
            if (!def) return null;
            const { Icon, bg, filled } = def;
            return (
              <motion.span
                key={f.id}
                initial={{
                  left: f.x - 22,
                  top: f.y,
                  opacity: 0,
                  scale: 0.4,
                  rotate: 0,
                }}
                animate={{
                  left: f.x - 22 + f.drift,
                  top: f.y - 320,
                  opacity: [0, 1, 1, 0],
                  scale: [0.4, 1.2, 1, 0.85],
                  rotate: f.rotate,
                }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: 1.8,
                  ease: [0.2, 0.7, 0.3, 1],
                  opacity: { times: [0, 0.15, 0.7, 1] },
                  scale: { times: [0, 0.2, 0.6, 1] },
                }}
                onAnimationComplete={() => {
                  setFloats((prev) => prev.filter((x) => x.id !== f.id));
                }}
                className={`absolute h-11 w-11 rounded-full grid place-items-center will-change-transform shadow-[0_6px_18px_-6px_rgba(0,0,0,0.6)] ${bg}`}
              >
                <Icon
                  className="h-6 w-6 text-white"
                  fill={filled ? "currentColor" : "none"}
                  strokeWidth={filled ? 1.5 : 2}
                />
              </motion.span>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Reactions bar. Each tile is an Apple-Watch-style solid colour
          circle with a white filled icon — no emoji glyphs (so platform
          rendering can't make a heart look hollow). Sits just above the
          bottom tab dock (which is ~76px + safe-area tall). Hidden on
          mobile while voting is open so the sticky vote CTA owns the
          bottom of the screen; floats themselves still render. */}
      <div
        className={`fixed left-0 right-0 z-30 flex justify-center pointer-events-none px-2 ${
          liftAboveComposer
            ? "bottom-[calc(env(safe-area-inset-bottom)+8.75rem)]"
            : "bottom-[calc(env(safe-area-inset-bottom)+5.5rem)]"
        } ${hideBarOnMobile ? "hidden sm:flex" : ""}`}
      >
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 280, damping: 28, delay: 0.3 }}
          className="pointer-events-auto glass-card rounded-full px-2 py-1.5 flex gap-1.5
                     max-w-[calc(100vw-1.5rem)]"
        >
          {REACTIONS.map(({ id, Icon, bg, filled, label }) => (
            <motion.button
              key={id}
              type="button"
              onClick={() => send(id)}
              whileHover={{ scale: 1.15, y: -2 }}
              whileTap={{ scale: 0.85 }}
              transition={{ type: "spring", stiffness: 500, damping: 18 }}
              className={`h-11 w-11 sm:h-12 sm:w-12 shrink-0 grid place-items-center rounded-full
                          ring-1 ring-white/15 shadow-[0_4px_12px_-4px_rgba(0,0,0,0.5)] ${bg}`}
              aria-label={label}
            >
              <Icon
                className="h-5 w-5 sm:h-6 sm:w-6 text-white"
                fill={filled ? "currentColor" : "none"}
                strokeWidth={filled ? 1.5 : 2}
              />
            </motion.button>
          ))}
        </motion.div>
      </div>

      <span data-room={code} hidden />
    </>
  );
}
