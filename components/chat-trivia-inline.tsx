"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, X } from "lucide-react";
import { HeartFlag } from "@/components/flag";
import { getCountry, countryName } from "@/lib/countries";
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
const SEEN_KEY = (room: string) => `uzk_trivia_seen_${room}`;
const LETTERS: ["A", "B", "C", "D"] = ["A", "B", "C", "D"];
const FLASH_MS = 1400;

type Phase =
  | { kind: "idle" }
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

  // First-view flash gate. Two suppressors:
  //   - player already answered (loaded from localStorage above)
  //   - we've already shown the flash once for this country/room
  // Otherwise: light up the breaking-news overlay, remember we did,
  // and auto-dismiss after FLASH_MS.
  useEffect(() => {
    if (!card) return;
    try {
      const raw = localStorage.getItem(SEEN_KEY(roomCode));
      const seen = raw ? (JSON.parse(raw) as Record<string, true>) : {};
      if (seen[countryCode]) return;
      // Player already has a stored answer → skip the flash and just
      // mark seen so a future fresh load also lands directly.
      const ansRaw = localStorage.getItem(LOCAL_KEY(roomCode));
      const ansMap = ansRaw ? (JSON.parse(ansRaw) as Record<string, TriviaPick>) : {};
      if (typeof ansMap[countryCode] === "number") {
        seen[countryCode] = true;
        localStorage.setItem(SEEN_KEY(roomCode), JSON.stringify(seen));
        return;
      }
      setFlashing(true);
      seen[countryCode] = true;
      localStorage.setItem(SEEN_KEY(roomCode), JSON.stringify(seen));
      const handle = window.setTimeout(() => setFlashing(false), FLASH_MS);
      return () => window.clearTimeout(handle);
    } catch {
      /* ignore */
    }
  }, [card, countryCode, roomCode]);

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
      // Optimistic reveal — the correct answer is on the client.
      setPhase({
        kind: "answered",
        choice,
        correct: choice === card.correctIndex,
        correctIndex: card.correctIndex,
      });
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
  const country = getCountry(countryCode);
  const block = card[lang] ?? card.en;
  const showReveal = phase.kind === "answered" || phase.kind === "closed";
  const closed = phase.kind === "closed";

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

        {/* Answer plates. WWTBAM uses elongated hexagons with a gold
            outline and a vertical divider between the letter and the
            answer text. We fake the hex with strong rounded corners +
            a gold gradient ring, and the divider is a 1px gold line. */}
        <ul className="flex flex-col gap-2.5">
          {block.choices.map((c, i) => {
            const idx = i as TriviaPick;
            const isCorrect = idx === card.correctIndex;
            const isPicked =
              showReveal && phase.kind === "answered" && phase.choice === idx;
            const revealTone =
              showReveal && isCorrect
                ? closed
                  ? "from-white/[0.10] to-white/[0.04] ring-white/25"
                  : "from-emerald-500/35 to-emerald-600/25 ring-emerald-300/70"
                : showReveal && isPicked
                  ? "from-error/35 to-error/20 ring-error/70"
                  : showReveal
                    ? "from-dark-blue-800/60 to-dark-blue-900/60 ring-white/10 text-white/55"
                    : "from-[#0e1f5e] to-[#0a1444] ring-yellow/45 hover:from-[#13288a] hover:to-[#0c1a5a] hover:ring-yellow/70";
            const letterTone =
              showReveal && isCorrect
                ? "text-emerald-200"
                : showReveal && isPicked
                  ? "text-red-200"
                  : "text-yellow";
            return (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => submit(idx)}
                  disabled={showReveal}
                  className={`group relative w-full flex items-stretch rounded-2xl
                              bg-gradient-to-b ${revealTone}
                              ring-1 transition transform-gpu
                              ${showReveal ? "" : "active:scale-[0.99]"}
                              shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_8px_18px_-12px_rgba(255,196,84,0.5)]`}
                >
                  {/* Letter cell. Fixed width so the divider stays at
                      the same x across plates. */}
                  <span
                    className={`shrink-0 w-12 grid place-items-center font-display text-base
                                ${letterTone}`}
                  >
                    {showReveal && isCorrect ? (
                      <Check className="h-5 w-5" strokeWidth={2.5} />
                    ) : showReveal && isPicked ? (
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
                  <span className="flex-1 text-left text-sm font-display leading-snug text-white py-3 pl-3 pr-4">
                    {c}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {showReveal && (
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className={`text-xs font-display text-center ${
              phase.kind === "answered" && phase.correct
                ? "text-emerald-300"
                : "text-white/65"
            }`}
          >
            {closed
              ? t(lang, "trivia_closed")
              : phase.kind === "answered" && phase.correct
                ? t(lang, "trivia_answered_correct")
                : t(lang, "trivia_answered_wrong")}
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

                <motion.div
                  initial={{ opacity: 0, x: 14 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.28, duration: 0.4, ease: "easeOut" }}
                  className="min-w-0"
                >
                  <p className="text-[9px] uppercase tracking-[0.34em] text-white/85 font-display leading-tight">
                    {t(lang, "trivia_breaking_kicker")}
                  </p>
                  <p className="font-display text-white text-lg sm:text-xl leading-tight uppercase tracking-wide truncate">
                    {t(lang, "trivia_breaking")}
                  </p>
                </motion.div>
              </div>
            </motion.div>

            {/* Country chip in the bottom-right of the flash plate so
                the player already knows what's coming. */}
            {country && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.32 }}
                className="absolute bottom-3 right-4 flex items-center gap-1.5
                           text-[10px] uppercase tracking-[0.26em] text-white/80
                           font-display"
              >
                <HeartFlag code={country.code} size="sm" />
                <span>{countryName(country.code, lang)}</span>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
