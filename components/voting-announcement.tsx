"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { useRoomLive } from "@/components/room-shell";
import { useLang, t } from "@/lib/i18n";

// Full-screen, can't-miss takeover when the host flips voting state.
// false→true  → "Europe, start voting now!" (the iconic line)
// true→false  → "3… 2… 1…" countdown then "Stop voting now!"
// Portaled to <body>, z above everything, auto-dismisses. Purely a
// reaction to the votingEnabled value in <RoomShell>'s live context —
// no broadcast of its own.

type Phase =
  | { kind: "open" }
  | { kind: "count"; n: number }
  | { kind: "stop" };

export function VotingAnnouncement() {
  const { votingEnabled } = useRoomLive();
  const lang = useLang();
  const prev = useRef<boolean | null>(null);
  const [phase, setPhase] = useState<Phase | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const clearAll = () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
    if (prev.current === null) {
      prev.current = votingEnabled;
      return;
    }
    if (prev.current === votingEnabled) return;
    prev.current = votingEnabled;
    clearAll();

    if (votingEnabled) {
      setPhase({ kind: "open" });
      timers.current.push(setTimeout(() => setPhase(null), 3600));
    } else {
      setPhase({ kind: "count", n: 3 });
      timers.current.push(setTimeout(() => setPhase({ kind: "count", n: 2 }), 900));
      timers.current.push(setTimeout(() => setPhase({ kind: "count", n: 1 }), 1800));
      timers.current.push(setTimeout(() => setPhase({ kind: "stop" }), 2700));
      timers.current.push(setTimeout(() => setPhase(null), 5000));
    }
    return clearAll;
  }, [votingEnabled]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {phase && (
        <motion.div
          key={phase.kind === "count" ? "count" : phase.kind}
          className="fixed inset-0 z-[95] flex flex-col items-center justify-center px-8 text-center pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          {/* Wash */}
          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              background:
                phase.kind === "open"
                  ? "radial-gradient(120% 120% at 50% 40%, rgba(10,12,40,0.78), rgba(5,6,20,0.95))"
                  : "radial-gradient(120% 120% at 50% 45%, rgba(40,8,16,0.82), rgba(8,4,8,0.96))",
            }}
          />
          {/* Rainbow sheen sweep for the OPEN moment */}
          {phase.kind === "open" && (
            <motion.div
              className="absolute inset-x-0 h-[40vh] top-[30vh] opacity-30 blur-2xl"
              style={{
                background:
                  "linear-gradient(90deg,#ff5fa2,#ffd166,#06d6a0,#4cc9f0,#b15bff,#ff5fa2)",
                backgroundSize: "200% 100%",
              }}
              animate={{ backgroundPositionX: ["0%", "200%"] }}
              transition={{ duration: 2.2, ease: "linear", repeat: Infinity }}
            />
          )}

          {phase.kind === "count" ? (
            <motion.div
              key={phase.n}
              className="relative text-[34vw] leading-none font-black text-white drop-shadow-[0_0_40px_rgba(255,80,120,0.6)]"
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.6, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 18 }}
            >
              {phase.n}
            </motion.div>
          ) : (
            <motion.div
              className="relative flex flex-col items-center gap-3"
              initial={{ scale: 0.7, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 18 }}
            >
              <motion.h2
                className="text-4xl sm:text-6xl font-black uppercase tracking-tight text-white drop-shadow-[0_4px_28px_rgba(0,0,0,0.5)]"
                animate={{ scale: [1, 1.04, 1] }}
                transition={{ duration: 1.1, repeat: Infinity }}
              >
                {phase.kind === "open"
                  ? t(lang, "vote_open_now")
                  : t(lang, "vote_closing")}
              </motion.h2>
              <p className="text-base sm:text-lg text-white/75 max-w-xs">
                {phase.kind === "open"
                  ? t(lang, "vote_open_now_sub")
                  : t(lang, "vote_closing_sub")}
              </p>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
