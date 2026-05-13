"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { HelpCircle, X, Check } from "lucide-react";
import { useRoomLive } from "@/components/room-shell";
import { useIdentity } from "@/lib/use-identity";
import { getCountry, countryName } from "@/lib/countries";
import { Flag } from "@/components/flag";
import { getTrivia, triviaOffsetMs, type TriviaPick } from "@/lib/trivia";
import { t } from "@/lib/i18n";
import { useLang } from "@/lib/i18n-client";

// "Who Wants to be a Millionaire"-style trivia card. Mounts once at
// room-shell level and listens for nowPlayingCode changes — when a
// country with a trivia entry hits the stage, it schedules a local
// timeout (deterministic across all clients in the room via
// triviaOffsetMs) and pops a non-blocking card above the tab bar.
//
// "Non-takeover": no backdrop, no scroll lock, no z-stomp over the tab
// bar. The rest of the app is still tappable behind/around the card.

const NO_ANSWER_DISMISS_MS = 90_000;
const REVEAL_DISMISS_MS = 5_000;
const LOCAL_KEY = (room: string) => `uzk_trivia_${room}`;

const LETTERS: ["A", "B", "C", "D"] = ["A", "B", "C", "D"];

type Phase =
  | { kind: "idle"; countryCode: string; answeredAt?: never }
  | {
      kind: "answered";
      countryCode: string;
      choice: TriviaPick;
      correct: boolean;
      correctIndex: TriviaPick;
    };

export function TriviaCard() {
  const { code, nowPlayingCode, showStatus, tallyEnabled } = useRoomLive();
  const { sessionId: getSession } = useIdentity();
  const lang = useLang();
  const session = getSession();
  const [phase, setPhase] = useState<Phase | null>(null);
  // Per country, only fire once per page lifetime — prevents thrash if
  // the host toggles nowPlayingCode quickly.
  const scheduled = useRef<Set<string>>(new Set());

  const recordAnswered = useCallback((country: string) => {
    try {
      const arr = JSON.parse(localStorage.getItem(LOCAL_KEY(code)) ?? "[]") as string[];
      if (Array.isArray(arr) && !arr.includes(country)) {
        arr.push(country);
        localStorage.setItem(LOCAL_KEY(code), JSON.stringify(arr));
      }
    } catch {
      /* private mode */
    }
  }, [code]);

  // Schedule a card when a new country hits the stage. Three gates:
  //   1. there must be a country on the stage (nowPlayingCode);
  //   2. the show must actually be live (not break/ended/not_started) —
  //      otherwise a stale nowPlayingCode would fire trivia in dead air;
  //   3. results haven't been revealed yet (tallyEnabled flips that
  //      branch into Rezultatai).
  useEffect(() => {
    if (!nowPlayingCode) return;
    if (showStatus !== "in_progress") return;
    if (tallyEnabled) return;
    const country = nowPlayingCode;
    if (!getTrivia(country)) return;
    if (scheduled.current.has(country)) return;
    try {
      const arr = JSON.parse(localStorage.getItem(LOCAL_KEY(code)) ?? "[]") as string[];
      if (Array.isArray(arr) && arr.includes(country)) return; // already played
    } catch {
      /* ignore */
    }
    scheduled.current.add(country);
    const delay = triviaOffsetMs(code, country);
    const id = window.setTimeout(() => {
      setPhase({ kind: "idle", countryCode: country });
    }, delay);
    return () => {
      window.clearTimeout(id);
    };
  }, [nowPlayingCode, code, showStatus, tallyEnabled]);

  // Auto-dismiss timer.
  useEffect(() => {
    if (!phase) return;
    const ms = phase.kind === "answered" ? REVEAL_DISMISS_MS : NO_ANSWER_DISMISS_MS;
    const id = window.setTimeout(() => setPhase(null), ms);
    return () => window.clearTimeout(id);
  }, [phase]);

  const submit = useCallback(
    async (choice: TriviaPick) => {
      if (!phase || phase.kind !== "idle") return;
      const country = phase.countryCode;
      const card = getTrivia(country);
      if (!card) return;
      recordAnswered(country);
      // Optimistic reveal — we have the correct answer locally already.
      setPhase({
        kind: "answered",
        countryCode: country,
        choice,
        correct: choice === card.correctIndex,
        correctIndex: card.correctIndex,
      });
      try {
        await fetch(`/api/rooms/${code}/trivia`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sessionId: session, countryCode: country, choiceIndex: choice }),
        });
      } catch {
        /* server-side scoring missed — user still sees the right answer */
      }
    },
    [phase, code, session, recordAnswered],
  );

  const card = phase ? getTrivia(phase.countryCode) : null;
  if (!phase || !card) return null;
  const country = getCountry(phase.countryCode);
  const block = card[lang] ?? card.en;
  const answeredIdx = phase.kind === "answered" ? phase.choice : null;
  const correctIdx = card.correctIndex;
  const showReveal = phase.kind === "answered";

  return (
    <AnimatePresence>
      <motion.aside
        key={phase.countryCode}
        initial={{ y: 32, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 32, opacity: 0, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
        role="dialog"
        aria-label="Trivia"
        // Floats just above the tab dock, never scrim-blocks the page.
        // z-30 keeps it under modal sheets (z-60+) but above home tiles.
        className="fixed left-2 right-2 z-30 mx-auto w-auto max-w-md
                   bottom-[calc(env(safe-area-inset-bottom)+5.25rem)]"
      >
        <div
          className="relative overflow-hidden rounded-3xl shadow-2xl
                     ring-2 ring-[#ffd166]/40"
          style={{
            background:
              "linear-gradient(160deg, #0c1b53 0%, #19308a 50%, #2c1a72 100%)",
          }}
        >
          {/* a subtle starfield + a curtain of gold to channel Millionaire */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.14]"
            style={{
              backgroundImage:
                "radial-gradient(rgba(255,209,102,0.7) 1px, transparent 1.5px)",
              backgroundSize: "18px 18px",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -top-12 left-1/2 -translate-x-1/2 h-32 w-[200%]
                       blur-3xl opacity-30"
            style={{ background: "radial-gradient(closest-side, #ffd166, transparent)" }}
          />

          <header className="relative flex items-center gap-2 px-4 pt-3 pb-2">
            {country && <Flag code={country.code} size="sm" />}
            <p className="text-[10px] uppercase tracking-[0.3em] text-[#ffd166] font-display leading-tight flex items-center gap-1.5">
              <HelpCircle className="h-3 w-3" />
              {t(lang, "trivia_eyebrow")}
              {country && (
                <>
                  <span className="text-white/40 mx-1">·</span>
                  <span className="text-white/85 normal-case tracking-normal">
                    {countryName(country.code, lang)}
                  </span>
                </>
              )}
            </p>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => setPhase(null)}
              aria-label={t(lang, "close")}
              className="h-7 w-7 grid place-items-center rounded-full bg-white/[0.08] text-white/70 hover:text-white hover:bg-white/15 transition"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </header>

          <div className="relative px-4 pb-4 flex flex-col gap-3">
            <p className="font-display text-base sm:text-lg text-white leading-snug drop-shadow-sm text-balance">
              {block.question}
            </p>
            <ul className="flex flex-col gap-2">
              {block.choices.map((choice, i) => {
                const idx = i as TriviaPick;
                const isChosen = answeredIdx === idx;
                const isCorrect = idx === correctIdx;
                const state = !showReveal
                  ? "idle"
                  : isCorrect
                    ? "correct"
                    : isChosen
                      ? "wrong"
                      : "muted";
                return (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => submit(idx)}
                      disabled={showReveal}
                      className={`w-full flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition transform-gpu
                                  ${
                                    state === "idle"
                                      ? "bg-[#0a154a] ring-1 ring-[#ffd166]/30 hover:bg-[#13226b] hover:ring-[#ffd166]/55 active:scale-[0.98]"
                                      : state === "correct"
                                        ? "bg-success/30 ring-2 ring-success"
                                        : state === "wrong"
                                          ? "bg-error/25 ring-2 ring-error/70"
                                          : "bg-[#0a154a]/60 ring-1 ring-white/10 opacity-50"
                                  }`}
                    >
                      <span
                        className={`shrink-0 h-9 w-9 grid place-items-center rounded-xl font-display text-base
                                    ${
                                      state === "correct"
                                        ? "bg-success text-white"
                                        : state === "wrong"
                                          ? "bg-error text-white"
                                          : "bg-gradient-to-br from-[#ffd166] to-[#f0a400] text-[#0c1b53]"
                                    }`}
                      >
                        {state === "correct" ? (
                          <Check className="h-4 w-4" strokeWidth={3} />
                        ) : state === "wrong" ? (
                          <X className="h-4 w-4" strokeWidth={3} />
                        ) : (
                          LETTERS[i]
                        )}
                      </span>
                      <span className="text-sm sm:text-base text-white leading-snug">
                        {choice}
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
                transition={{ duration: 0.22, delay: 0.1 }}
                className={`text-sm font-display text-center ${
                  phase.kind === "answered" && phase.correct ? "text-success" : "text-white/70"
                }`}
              >
                {phase.kind === "answered" && phase.correct
                  ? t(lang, "trivia_answered_correct")
                  : t(lang, "trivia_answered_wrong")}
              </motion.p>
            )}
          </div>
        </div>
      </motion.aside>
    </AnimatePresence>
  );
}
