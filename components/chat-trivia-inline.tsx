"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { getTrivia, type TriviaPick } from "@/lib/trivia";
import { useIdentity } from "@/lib/use-identity";
import { bumpVibe } from "@/lib/use-vibe-tracker";
import { t } from "@/lib/i18n";
import type { Language } from "@/lib/i18n";

// Inline trivia card rendered as a chat-row message. Two beats:
//
//   1. Breaking-news flash (~1.4s on first view): a red bar slams in
//      across the card with "QUICK QUESTION!" in bold display caps,
//      a pulsing LIVE dot, and the country chip. Sets the moment as
//      a Thing — the chat thread is already busy, the trivia card
//      can't be just another row, it has to land.
//   2. Crossfade to a Who-Wants-To-Be-A-Millionaire-style panel:
//      deep blue gradient with a faint spotlight glow, the question
//      typeset large, and four diamond-shaped answer plates with
//      gold A/B/C/D badges and a vertical divider. Reveal state
//      tints the chosen + correct plates emerald / red.
//
// "First view" is tracked per-room-per-country in localStorage so
// scroll-backs or tab reopens skip the flash and land directly on
// the question. The server still has the durable answer in
// trivia_answers; this component is just the surface.
const LOCAL_KEY = (room: string) => `uzk_trivia_${room}`;
// Per-room cache of "I've already SEEN this country's trivia card
// land in chat (i.e. the breaking-news flash already played for this
// session)". Survives reloads; that's the point — refreshing the
// page shouldn't re-fire the flash for trivia that was already
// posted minutes ago. localStorage instead of sessionStorage so it
// survives across PWA cold-starts (sessionStorage clears on PWA
// re-launch).
const SEEN_KEY = (room: string) => `uzk_trivia_seen_${room}`;
const LETTERS: ["A", "B", "C", "D"] = ["A", "B", "C", "D"];
const FLASH_MS = 1900;
// WWTBAM-style reveal beats. Tap → instant LOCK (the chosen plate
// turns gold). After LOCK_HOLD_MS → BLINK (the gold pulses for
// suspense). After BLINK_MS → ANSWERED (the chosen turns
// emerald/red, the correct one always gets the emerald wash + "+2"
// chip). Total dramatic build ~2.4s.
const LOCK_HOLD_MS = 900;
const BLINK_MS = 1500;

type Phase =
  | { kind: "idle" }
  | { kind: "locked"; choice: TriviaPick; correctIndex: TriviaPick }
  | { kind: "blinking"; choice: TriviaPick; correctIndex: TriviaPick }
  | { kind: "answered"; choice: TriviaPick; correct: boolean; correctIndex: TriviaPick }
  // "Country left the stage before this player answered." Card stays
  // visible (so the question + correct answer can be read after the
  // fact) but buttons are inert and no choice is highlighted.
  | { kind: "closed"; correctIndex: TriviaPick };

type TriviaSnapshot = {
  correctIndex: number;
  en: { question: string; choices: string[] };
  lt: { question: string; choices: string[] };
};

export function ChatTriviaCard({
  countryCode,
  snapshot,
  roomCode,
  lang,
  isOnStage,
}: {
  countryCode: string;
  /** Server-embedded question payload; preferred over the file deck so
   *  admin edits to lib/trivia.ts (or DB) don't rewrite an in-flight card. */
  snapshot: TriviaSnapshot | null;
  roomCode: string;
  lang: Language;
  isOnStage: boolean;
}) {
  const { sessionId: getSession } = useIdentity();
  const session = getSession();
  // MEMOISED. Previous version rebuilt `card` on every render, which
  // made its identity unstable. The restore-from-localStorage effect
  // below has `card` in its deps — without memo, that effect re-ran
  // every render, read the just-written answer right after submit(),
  // and overwrote the in-flight `locked` phase with `answered`,
  // skipping the entire WWTBAM lock → blink → reveal sequence. Now
  // the object identity only changes when the snapshot itself
  // changes (essentially never within one card's lifetime).
  const fallback = useMemo(() => getTrivia(countryCode), [countryCode]);
  const card = useMemo(() => {
    if (!snapshot) return fallback;
    return {
      country: countryCode,
      correctIndex: snapshot.correctIndex as TriviaPick,
      en: {
        question: snapshot.en.question,
        choices: [
          snapshot.en.choices[0] ?? "",
          snapshot.en.choices[1] ?? "",
          snapshot.en.choices[2] ?? "",
          snapshot.en.choices[3] ?? "",
        ] as [string, string, string, string],
      },
      lt: {
        question: snapshot.lt.question,
        choices: [
          snapshot.lt.choices[0] ?? "",
          snapshot.lt.choices[1] ?? "",
          snapshot.lt.choices[2] ?? "",
          snapshot.lt.choices[3] ?? "",
        ] as [string, string, string, string],
      },
    };
  }, [snapshot, countryCode, fallback]);

  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  // `flashing` controls the breaking-news overlay. Default `false` so
  // we don't briefly paint it before checking localStorage — the
  // post-mount effect flips it on for genuine first views.
  const [flashing, setFlashing] = useState(false);

  // Restore "I already answered this country" from localStorage on
  // mount — the player gets the reveal view instantly on tab re-
  // open. Gated by a ref so it ONLY fires the first time card is
  // available; otherwise the upstream `snapshot` prop being rebuilt
  // on every chat-row render (new object identity) made this effect
  // re-fire AFTER submit() and overwrite the in-flight `locked`
  // phase with `answered`, skipping the entire WWTBAM animation.
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    if (!card) return;
    restoredRef.current = true;
    try {
      const raw = localStorage.getItem(LOCAL_KEY(roomCode));
      const map = raw ? (JSON.parse(raw) as Record<string, TriviaPick>) : {};
      const prior = map[countryCode];
      if (typeof prior === "number") {
        setPhase({
          kind: "answered",
          choice: prior,
          correct: prior === card.correctIndex,
          correctIndex: card.correctIndex,
        });
      }
    } catch {
      /* ignore corrupt local state */
    }
  }, [card, countryCode, roomCode]);

  // First-view flash gate.
  //
  // Two suppressors:
  //   1. Already answered → phase loaded as "answered" from
  //      localStorage above; flash is redundant, skip.
  //   2. Already SEEN → SEEN_KEY in localStorage records that the
  //      flash already played for this country in this room. Without
  //      this, refreshing the page after the trivia message landed
  //      would replay the breaking-news bar every reload.
  //
  // Strict-mode safety: the SEEN_KEY write is DEFERRED to AFTER the
  // flash starts (rAF + 60ms) so React's dev double-mount doesn't
  // cause Mount 1 to write the flag synchronously and Mount 2 to
  // bail before painting. Mount 1's deferred write is harmless if
  // it runs (Mount 2's check sees the flag too); the user-visible
  // mount is Mount 2, and it gets its own setFlashing(true) before
  // the flag is set.
  const flashFiredRef = useRef(false);
  useEffect(() => {
    if (!card) return;
    if (flashFiredRef.current) return;
    if (phase.kind === "answered") return;
    try {
      const raw = localStorage.getItem(SEEN_KEY(roomCode));
      const seen = raw ? (JSON.parse(raw) as Record<string, true>) : {};
      if (seen[countryCode]) return;
    } catch {
      /* ignore — fall through and play the flash */
    }
    flashFiredRef.current = true;
    setFlashing(true);
    // Stamp SEEN after the flash starts (next rAF + a small buffer)
    // so a strict-mode double-invoke doesn't mark seen before the
    // visible mount renders.
    requestAnimationFrame(() => {
      window.setTimeout(() => {
        try {
          const raw = localStorage.getItem(SEEN_KEY(roomCode));
          const seen = raw ? (JSON.parse(raw) as Record<string, true>) : {};
          if (!seen[countryCode]) {
            seen[countryCode] = true;
            localStorage.setItem(SEEN_KEY(roomCode), JSON.stringify(seen));
          }
        } catch {
          /* private mode / quota exceeded — flash still played */
        }
      }, 60);
    });
    // setFlashing(false) timeout intentionally has no cleanup;
    // setFlashing on unmount is a no-op in React 18+.
    window.setTimeout(() => setFlashing(false), FLASH_MS);
  }, [card, phase.kind, countryCode, roomCode]);

  // Country navigated away while this player was still on the idle
  // buttons view → close the card (reveal answer, disable buttons).
  // Stays sticky if the country later comes back on stage; the player
  // had their window and missed it.
  useEffect(() => {
    if (!card) return;
    if (!isOnStage && phase.kind === "idle") {
      setPhase({ kind: "closed", correctIndex: card.correctIndex });
    }
  }, [card, isOnStage, phase.kind]);

  const submit = useCallback(
    async (choice: TriviaPick) => {
      if (!card || phase.kind !== "idle") return;
      try {
        const raw = localStorage.getItem(LOCAL_KEY(roomCode));
        const map = raw ? (JSON.parse(raw) as Record<string, TriviaPick>) : {};
        map[countryCode] = choice;
        localStorage.setItem(LOCAL_KEY(roomCode), JSON.stringify(map));
      } catch {
        /* ignore */
      }
      // WWTBAM dramatic reveal. Three beats:
      //   1. LOCK (instant): chosen plate turns gold.
      //   2. BLINK (after LOCK_HOLD_MS): gold flashes for suspense.
      //   3. ANSWERED (after BLINK_MS): chosen → emerald/red,
      //      correct → emerald + "+2" chip.
      // No cleanup on the timeouts — setState on unmount is a no-op.
      setPhase({ kind: "locked", choice, correctIndex: card.correctIndex });
      window.setTimeout(() => {
        setPhase({ kind: "blinking", choice, correctIndex: card.correctIndex });
      }, LOCK_HOLD_MS);
      window.setTimeout(() => {
        setPhase({
          kind: "answered",
          choice,
          correct: choice === card.correctIndex,
          correctIndex: card.correctIndex,
        });
      }, LOCK_HOLD_MS + BLINK_MS);
      bumpVibe("triviaAnswered");
      try {
        const res = await fetch(`/api/rooms/${roomCode}/trivia`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sessionId: session, countryCode, choiceIndex: choice }),
        });
        // 409 + tooLate + correct: the player got the right answer
        // but the per-room cap was already hit. The plate still
        // flips emerald (the answer IS right), but there are no
        // points and we owe the player an explanation — otherwise
        // they see "Check + green plate, no +2 chip" and assume a
        // bug. Toast it.
        if (!res.ok && res.status === 409) {
          const data = (await res.json().catch(() => null)) as
            | { tooLate?: boolean; correct?: boolean; cap?: number | null }
            | null;
          if (data?.tooLate && data.correct) {
            const cap = data.cap ?? 0;
            toast.info(t(lang, "trivia_too_late_correct_toast", cap));
          }
        }
      } catch {
        /* server-side scoring missed — player still sees the reveal */
      }
    },
    // `phase.kind` (not full `phase`) — the callback only reads the
    // kind tag at the top guard; pulling the whole phase object in
    // re-creates submit() on every locked/blinking transition for
    // no benefit.
    [card, phase.kind, countryCode, roomCode, session, lang],
  );

  if (!card) return null;
  const block = card[lang] ?? card.en;
  const interactive = phase.kind === "idle";
  const locked = phase.kind === "locked";
  const blinking = phase.kind === "blinking";
  const revealed = phase.kind === "answered" || phase.kind === "closed";
  const closed = phase.kind === "closed";
  const chosenIdx =
    phase.kind === "locked" || phase.kind === "blinking" || phase.kind === "answered"
      ? phase.choice
      : null;

  return (
    <div
      className="relative rounded-3xl ring-1 ring-yellow/45 overflow-hidden
                 shadow-[0_24px_56px_-22px_oklch(72%_0.18_85_/_0.55)]"
    >
      {/* WWTBAM stage. Deep blue radial spotlight from the top, gold
          highlight band along the very top edge, and a faint vertical
          vignette so the answer plates feel lit from above. */}
      <div
        className="relative p-5 flex flex-col gap-4"
        style={{
          background:
            "radial-gradient(120% 80% at 50% -10%, rgba(255, 196, 84, 0.18) 0%, rgba(28, 50, 138, 0.95) 38%, #0a1444 75%, #050a26 100%)",
        }}
      >
        {/* Gold rim along the top — small but it's the WWTBAM signature. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, oklch(80% 0.18 85 / 0.85) 50%, transparent 100%)",
          }}
        />

        {/* No eyebrow + no country chip — by the time this card is
            in chat, the country is ALREADY on stage in the room
            header (PresenceBar shows the heart-flag + name there).
            Repeating that here just steals headline-space from the
            question. Question takes the whole stage instead. */}

        {/* Question — the headline of the card. Bigger type, centred,
            with a soft gold drop-shadow so it reads as the lit
            podium element on the dark stage behind it. */}
        <div className="relative pt-1">
          <p
            className="font-display text-xl sm:text-2xl text-white leading-snug text-balance text-center px-2"
            style={{
              textShadow: "0 1px 22px oklch(80% 0.18 85 / 0.35)",
            }}
          >
            {block.question}
          </p>
        </div>

        {/* Answer plates. Locked → blinking → revealed flow:
            - idle: blue plates with gold rim, tappable
            - locked: chosen plate flips to gold (instant)
            - blinking: chosen plate's gold pulses (via .uzk-blink)
            - revealed: chosen → emerald/red, CORRECT plate always gets
              the emerald wash + a "+2" chip so the player sees the
              points even on a wrong guess. The closed branch (country
              left the stage before answering) keeps the buttons inert
              and just marks the correct one in muted white. */}
        <ul className="flex flex-col gap-2.5">
          {block.choices.map((c, i) => {
            const idx = i as TriviaPick;
            const isCorrect = idx === card.correctIndex;
            const isChosen = chosenIdx === idx;
            // Tone selector. Locked + blinking share the "chosen gold"
            // styling; blinking adds the pulse class. Revealed splits
            // into chosen/correct/dim. Idle is the default blue.
            let revealTone =
              "from-[#0e1f5e] to-[#0a1444] ring-yellow/45 hover:from-[#13288a] hover:to-[#0c1a5a] hover:ring-yellow/70";
            if (locked || blinking) {
              revealTone = isChosen
                ? "from-yellow/85 to-amber-500/85 ring-yellow text-dark-blue"
                : "from-[#0a1444]/70 to-[#050a26]/70 ring-white/10";
            } else if (revealed) {
              if (isCorrect) {
                revealTone = closed
                  ? "from-white/[0.10] to-white/[0.04] ring-white/25"
                  : "from-emerald-500/40 to-emerald-700/30 ring-emerald-300/70";
              } else if (isChosen) {
                revealTone = "from-error/35 to-error/20 ring-error/70";
              } else {
                revealTone = "from-dark-blue-800/60 to-dark-blue-900/60 ring-white/10 text-white/55";
              }
            }
            const letterTone = revealed && isCorrect
              ? "text-emerald-200"
              : revealed && isChosen
                ? "text-red-200"
                : (locked || blinking) && isChosen
                  ? "text-dark-blue"
                  : "text-yellow";
            return (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => submit(idx)}
                  disabled={!interactive}
                  className={`group relative w-full flex items-stretch rounded-2xl
                              bg-gradient-to-b ${revealTone}
                              ring-1 transition transform-gpu
                              ${interactive ? "active:scale-[0.99]" : ""}
                              ${locked && isChosen ? "uzk-trivia-lock" : ""}
                              ${blinking && isChosen ? "uzk-trivia-blink" : ""}
                              shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_8px_18px_-12px_rgba(255,196,84,0.5)]`}
                >
                  {/* Letter cell. Fixed width so the divider stays at
                      the same x across plates. */}
                  <span
                    className={`shrink-0 w-12 grid place-items-center font-display text-base
                                ${letterTone}`}
                  >
                    {revealed && isCorrect ? (
                      <Check className="h-5 w-5" strokeWidth={2.5} />
                    ) : revealed && isChosen ? (
                      <X className="h-5 w-5" strokeWidth={2.5} />
                    ) : (
                      LETTERS[i]
                    )}
                  </span>
                  {/* Gold vertical divider — the WWTBAM tell. */}
                  <span
                    aria-hidden
                    className="w-px self-stretch my-1.5"
                    style={{
                      background:
                        "linear-gradient(180deg, transparent 0%, oklch(80% 0.18 85 / 0.6) 50%, transparent 100%)",
                    }}
                  />
                  <span className={`flex-1 text-left text-sm font-display leading-snug py-3 pl-3 pr-4
                                    ${(locked || blinking) && isChosen ? "text-dark-blue" : "text-white"}`}>
                    {c}
                  </span>
                  {/* WWTBAM reveal flash — a one-shot white burst
                      that washes over the correct plate the instant
                      we hit the answered phase, then fades to reveal
                      the emerald wash underneath. Pointer-events-none
                      so it doesn't intercept taps. */}
                  {phase.kind === "answered" && isCorrect && !closed && (
                    <span
                      aria-hidden
                      className="uzk-trivia-reveal-flash pointer-events-none absolute inset-0 rounded-2xl"
                      style={{
                        background:
                          "radial-gradient(80% 100% at 50% 50%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.5) 40%, transparent 80%)",
                      }}
                    />
                  )}
                  {/* "+2" points chip — ONLY when the player actually
                      earned the points (correct pick, on time). The
                      chip used to land on the correct plate regardless
                      of outcome, which read as "I got 2 points" to a
                      player who'd just guessed wrong. Now it only
                      shows when phase.correct is true. */}
                  {phase.kind === "answered" && phase.correct && isCorrect && !closed && (
                    <span className="self-center mr-3 shrink-0 inline-flex items-center justify-center
                                     rounded-full bg-emerald-400/95 text-dark-blue font-display text-[11px]
                                     px-2 h-6">
                      +2
                    </span>
                  )}
                  {/* "Not this time" chip on the player's wrong pick.
                      Lives in the right gutter of the chosen (red)
                      plate so the player sees a tight loop: "I picked
                      this, it was wrong, here's the correct one" —
                      vs the old layout which only marked the correct
                      plate, leaving the player's wrong pick silent. */}
                  {phase.kind === "answered" && !phase.correct && isChosen && !isCorrect && (
                    <span className="self-center mr-3 shrink-0 inline-flex items-center justify-center
                                     rounded-full bg-error/40 ring-1 ring-error/55 text-white/90 font-display text-[10px]
                                     px-2 h-6 leading-none">
                      {t(lang, "trivia_not_this_time")}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        {/* Closed-state hint. Only renders when the country left the
            stage before the player answered — the right answer plate
            is still visible above (in muted white), this line just
            explains WHY everything's dimmed and that they missed the
            window. The answered (correct/wrong) state doesn't get a
            line; the +2 chip + plate colours speak for themselves. */}
        {closed && (
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32 }}
            className="text-xs font-display text-center text-white/65"
          >
            {t(lang, "trivia_closed")}
          </motion.p>
        )}
      </div>

      {/* Breaking-news overlay, redesigned. Three beats:
            1. (0–0.3s) Black plate slams down + a thin red bar
               carves across the bottom edge.
            2. (0.3–0.7s) "QUICK QUESTION!" headline drops in with
               per-character stagger, white drop-shadow lift.
            3. (0.7–1.4s) The headline shimmers (radial sweep), then
               the whole overlay crossfades out revealing the WWTBAM
               stage underneath. */}
      <AnimatePresence>
        {flashing && (
          <motion.div
            key="flash"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="absolute inset-0 z-10 overflow-hidden pointer-events-none"
            aria-hidden
          >
            {/* Plate. Sweeps in from black → deep red gradient at the
                bottom edge so the headline reads as a "live broadcast
                cut-in" instead of a flat banner. */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(120% 80% at 50% 50%, #181029 0%, #0a0613 70%, #050208 100%)",
              }}
            />

            {/* Two thin red rails: top + bottom. Slide in from
                opposite sides on a hard cubic-bezier so they snap
                closed like a TV news lower-third. */}
            <motion.div
              initial={{ scaleX: 0, transformOrigin: "left" }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-x-0 top-0 h-[3px]"
              style={{
                background:
                  "linear-gradient(90deg, transparent 0%, #d10a25 12%, #ff3050 50%, #d10a25 88%, transparent 100%)",
              }}
            />
            <motion.div
              initial={{ scaleX: 0, transformOrigin: "right" }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-x-0 bottom-0 h-[3px]"
              style={{
                background:
                  "linear-gradient(90deg, transparent 0%, #d10a25 12%, #ff3050 50%, #d10a25 88%, transparent 100%)",
              }}
            />

            {/* Headline block. Per-character drop-in with a tight
                stagger, then a slow shimmer sweep. */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6">
              {/* LIVE dot eyebrow — pulses once it lands. */}
              <motion.span
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.22, duration: 0.32, ease: "easeOut" }}
                className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.36em] font-display text-flamingo"
              >
                <span className="relative flex h-2 w-2">
                  <span className="absolute inset-0 rounded-full bg-flamingo/70 animate-ping" />
                  <span className="relative h-2 w-2 rounded-full bg-flamingo" />
                </span>
                Live
              </motion.span>

              {/* Per-character headline. Each glyph drops in 18ms
                  apart so the line reads as TYPED, not pasted. */}
              <h2
                className="font-display text-white text-3xl sm:text-4xl leading-tight uppercase tracking-tight text-center"
                style={{
                  textShadow:
                    "0 2px 18px rgba(255, 48, 80, 0.55), 0 0 6px rgba(0,0,0,0.6)",
                }}
              >
                {Array.from(t(lang, "trivia_breaking")).map((ch, i) => (
                  <motion.span
                    key={i}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      delay: 0.32 + i * 0.018,
                      duration: 0.28,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    className="inline-block"
                  >
                    {ch === " " ? " " : ch}
                  </motion.span>
                ))}
              </h2>

              {/* Shimmer sweep — a thin gold beam cuts across the
                  headline area at the back end of the flash. */}
              <motion.span
                aria-hidden
                initial={{ x: "-120%", opacity: 0 }}
                animate={{ x: "120%", opacity: [0, 0.9, 0] }}
                transition={{
                  delay: 0.85,
                  duration: 0.6,
                  ease: "easeInOut",
                  times: [0, 0.5, 1],
                }}
                className="pointer-events-none absolute left-0 right-0 top-1/2 h-16 -translate-y-1/2"
                style={{
                  background:
                    "linear-gradient(95deg, transparent 30%, rgba(255, 209, 102, 0.55) 48%, rgba(255, 255, 255, 0.85) 50%, rgba(255, 209, 102, 0.55) 52%, transparent 70%)",
                  filter: "blur(8px)",
                  mixBlendMode: "screen",
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
