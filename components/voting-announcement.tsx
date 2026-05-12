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
      timers.current.push(setTimeout(() => setPhase(null), 5200));
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
          ) : phase.kind === "open" ? (
            <div className="relative flex flex-col items-center gap-5">
              <WordsBurst text={t(lang, "vote_open_now")} />
            </div>
          ) : (
            <motion.div
              className="relative flex flex-col items-center gap-3"
              initial={{ scale: 0.7, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 18 }}
            >
              <motion.h2
                className="text-5xl sm:text-7xl font-black uppercase tracking-tight text-white drop-shadow-[0_4px_28px_rgba(0,0,0,0.5)]"
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                {t(lang, "vote_closing")}
              </motion.h2>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

// "EUROPE, START VOTING NOW!" word-by-word: each word springs in,
// staggered, in the display face. The rainbow shimmer is a `-webkit-
// background-clip:text` gradient — to keep iOS Safari from painting the
// infamous stray rectangle, the spring transform lives on the OUTER
// wrapper while the clipped-text span sits still on its own compositing
// layer (translateZ(0)), with the shimmer driven by a plain CSS
// keyframe rather than an animated transform/property on the same node.
function WordsBurst({ text }: { text: string }) {
  const words = text.toUpperCase().split(/\s+/);
  return (
    <h2
      className="relative font-display uppercase leading-[1.1] tracking-tight py-[0.12em]
                 text-[15vw] sm:text-[7rem] flex flex-wrap justify-center gap-x-[0.25em] gap-y-1
                 drop-shadow-[0_6px_36px_rgba(0,0,0,0.5)]"
    >
      {words.map((w, i) => (
        <motion.span
          key={`${w}-${i}`}
          className="inline-block"
          initial={{ opacity: 0, y: 40, scale: 0.4, rotate: i % 2 ? -6 : 6 }}
          animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
          transition={{ delay: 0.12 + i * 0.22, type: "spring", stiffness: 420, damping: 14 }}
        >
          <span
            className="inline-block text-shimmer"
            style={{
              backgroundImage:
                "linear-gradient(100deg,#ffffff,#ff5fa2,#ffd166,#4cc9f0,#b15bff,#ffffff)",
              backgroundSize: "260% 100%",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
              WebkitTextFillColor: "transparent",
              transform: "translateZ(0)",
              isolation: "isolate",
              paddingBottom: "0.08em",
            }}
          >
            {w}
          </span>
        </motion.span>
      ))}
    </h2>
  );
}
