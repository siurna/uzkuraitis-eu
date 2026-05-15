"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, X } from "lucide-react";
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
const LETTERS: ["A", "B", "C", "D"] = ["A", "B", "C", "D"];
const FLASH_MS = 1400;
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
  // Prefer the snapshot baked into the chat message; fall back to the
  // file-default deck for legacy messages that pre-date the snapshot.
  const fallback = getTrivia(countryCode);
  const card = snapshot
    ? {
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
      }
    : fallback;

  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  // `flashing` controls the breaking-news overlay. Default `false` so
  // we don't briefly paint it before checking localStorage — the
  // post-mount effect flips it on for genuine first views.
  const [flashing, setFlashing] = useState(false);

  // Restore "I already answered this country" from localStorage on
  // mount — the player gets the reveal view instantly instead of
  // momentarily seeing the buttons again on tab re-open.
  useEffect(() => {
    if (!card) return;
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

  // First-view flash gate. The trivia card is mounted exactly when
  // <DelayedTrivia/> flips ready=true (i.e. at the message's firesAt
  // timestamp), so a fresh mount IS a genuine first view — we don't
  // need localStorage gating, and removing it kills the strict-mode
  // dev wedge that the previous rounds kept hitting (Mount 1 wrote
  // SEEN_KEY synchronously, Mount 2 saw the flag and bailed without
  // ever showing the overlay). One in-component ref guards the
  // double-invoke per-mount; no cross-mount storage. Player who has
  // already answered this country sees no flash (loaded from
  // localStorage in the effect above sets phase=answered, which
  // makes the flash redundant, so we skip it).
  const flashFiredRef = useRef(false);
  useEffect(() => {
    if (!card) return;
    if (flashFiredRef.current) return;
    if (phase.kind === "answered") return;
    flashFiredRef.current = true;
    setFlashing(true);
    // No cleanup — setFlashing on unmount is a no-op in React 18+,
    // and we'd rather guarantee the false-flip than have strict-mode
    // cleanup cancel it.
    window.setTimeout(() => setFlashing(false), FLASH_MS);
  }, [card, phase.kind]);

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
        await fetch(`/api/rooms/${roomCode}/trivia`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sessionId: session, countryCode, choiceIndex: choice }),
        });
      } catch {
        /* server-side scoring missed — player still sees the reveal */
      }
    },
    [card, phase, countryCode, roomCode, session],
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
                  {/* "+2" points chip — only on the correct answer
                      once we're in the reveal phase. Sits in the
                      right gutter, doesn't shift the answer text. */}
                  {revealed && isCorrect && !closed && (
                    <span className="self-center mr-3 shrink-0 inline-flex items-center justify-center
                                     rounded-full bg-emerald-400/95 text-dark-blue font-display text-[11px]
                                     px-2 h-6">
                      +2
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

      {/* Breaking-news flash overlay. Lives on top of the millionaire
          stage and crossfades out after FLASH_MS. AnimatePresence
          handles the fade-out cleanup so the overlay unmounts cleanly
          once the question is the only thing left. */}
      <AnimatePresence>
        {flashing && (
          <motion.div
            key="flash"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="absolute inset-0 z-10 overflow-hidden pointer-events-none"
            aria-hidden
          >
            {/* Solid black plate behind the bar — guarantees we're not
                bleeding the millionaire view during the flash. */}
            <div className="absolute inset-0 bg-[#080820]" />

            {/* Diagonal red sweep — the bar. Slides in from the left,
                stops mid-card. */}
            <motion.div
              initial={{ x: "-110%" }}
              animate={{ x: "0%" }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-y-0 left-0 right-[-6%] flex items-center px-5"
              style={{
                background:
                  "linear-gradient(95deg, #b9001a 0%, #d10a25 55%, #a4001a 100%)",
                clipPath: "polygon(0 0, 100% 0, 96% 100%, 0 100%)",
                boxShadow:
                  "inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -1px 0 rgba(0,0,0,0.35), 0 12px 28px -10px rgba(185, 0, 26, 0.65)",
              }}
            >
              <div className="flex items-center gap-3 min-w-0">
                {/* LIVE dot — slow heartbeat, mirrors the rest of the app. */}
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className="absolute inset-0 rounded-full bg-white/60 animate-ping" />
                  <span className="relative h-2.5 w-2.5 rounded-full bg-white" />
                </span>

                <motion.p
                  initial={{ opacity: 0, x: 14 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.22, duration: 0.4, ease: "easeOut" }}
                  className="font-display text-white text-xl sm:text-2xl leading-tight uppercase tracking-wide truncate"
                >
                  {t(lang, "trivia_breaking")}
                </motion.p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
