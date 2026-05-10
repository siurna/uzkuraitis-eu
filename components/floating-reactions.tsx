"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useBroadcastEvent, useEventListener } from "@/lib/liveblocks";

const EMOJIS = ["❤️", "🔥", "🎤", "✨", "💃", "🇪🇺", "🥲", "💯"] as const;

type Float = {
  id: number;
  emoji: string;
  x: number;
  y: number;
  // Per-spawn randomness so a flurry of taps doesn't look uniform.
  rotate: number;
  drift: number;
};

let nextFloatId = 1;

export function FloatingReactionsLayer({ code }: { code: string }) {
  const [floats, setFloats] = useState<Float[]>([]);
  const broadcast = useBroadcastEvent();

  // Cap visible floats so a thousand-tap mashing session doesn't tank perf.
  useEffect(() => {
    if (floats.length > 60) {
      setFloats((prev) => prev.slice(-40));
    }
  }, [floats]);

  useEventListener(({ event }) => {
    if (event.type !== "floating") return;
    spawn(event.emoji, event.x, event.y);
  });

  const spawn = (emoji: string, x: number, y: number) => {
    setFloats((prev) => [
      ...prev,
      {
        id: nextFloatId++,
        emoji,
        x,
        y,
        rotate: (Math.random() - 0.5) * 60,
        drift: (Math.random() - 0.5) * 220,
      },
    ]);
  };

  const send = (emoji: string) => {
    const x = window.innerWidth / 2 + (Math.random() - 0.5) * 80;
    const y = window.innerHeight - 120;
    broadcast({ type: "floating", emoji, x, y });
    spawn(emoji, x, y);
    if ("vibrate" in navigator) navigator.vibrate?.(8);
  };

  return (
    <>
      <div className="fixed inset-0 z-40 pointer-events-none overflow-hidden">
        <AnimatePresence>
          {floats.map((f) => (
            <motion.span
              key={f.id}
              initial={{
                left: f.x - 16,
                top: f.y,
                opacity: 0,
                scale: 0.4,
                rotate: 0,
              }}
              animate={{
                left: f.x - 16 + f.drift,
                top: f.y - 320,
                opacity: [0, 1, 1, 0],
                scale: [0.4, 1.4, 1, 0.8],
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
              className="absolute text-4xl will-change-transform"
              style={{ filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.4))" }}
            >
              {f.emoji}
            </motion.span>
          ))}
        </AnimatePresence>
      </div>

      <div className="fixed bottom-20 left-0 right-0 z-30 flex justify-center pointer-events-none px-3">
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 280, damping: 28, delay: 0.3 }}
          className="pointer-events-auto glass-card rounded-full p-1 flex gap-0.5 shadow-glow-pink
                     max-w-full overflow-hidden"
        >
          {EMOJIS.map((e) => (
            <motion.button
              key={e}
              type="button"
              onClick={() => send(e)}
              whileHover={{ scale: 1.15, y: -2 }}
              whileTap={{ scale: 0.85 }}
              transition={{ type: "spring", stiffness: 500, damping: 18 }}
              className="h-9 w-9 sm:h-10 sm:w-10 shrink-0 grid place-items-center rounded-full
                         hover:bg-white/10 text-xl sm:text-2xl leading-none"
              aria-label={`React with ${e}`}
            >
              {e}
            </motion.button>
          ))}
        </motion.div>
      </div>

      <span data-room={code} hidden />
    </>
  );
}
