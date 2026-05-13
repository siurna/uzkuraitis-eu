"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import { Check, X, Lightbulb } from "lucide-react";
import { HeartFlag } from "@/components/flag";
import { getCountry, countryName } from "@/lib/countries";
import { getTrivia, type TriviaPick } from "@/lib/trivia";
import { useIdentity } from "@/lib/use-identity";
import { t } from "@/lib/i18n";
import type { Language } from "@/lib/i18n";

// Inline trivia card rendered as a chat-row message. Replaces the
// floating overlay version — the server posts a `kind: "trivia"`
// message when a country with trivia data takes the stage, and this
// component handles render + answer flow inline in the thread.
//
// State model is intentionally local + per-room (localStorage):
// players can refresh the tab and the "I already answered" state
// survives, but it's NOT cross-device (server has the durable answer
// in trivia_answers; this is just cosmetic so the same message in
// chat doesn't suddenly re-show the buttons after a reload).
const LOCAL_KEY = (room: string) => `uzk_trivia_${room}`;
const LETTERS: ["A", "B", "C", "D"] = ["A", "B", "C", "D"];

type Phase =
  | { kind: "idle" }
  | { kind: "answered"; choice: TriviaPick; correct: boolean; correctIndex: TriviaPick };

export function ChatTriviaCard({
  countryCode,
  roomCode,
  lang,
}: {
  countryCode: string;
  roomCode: string;
  lang: Language;
}) {
  const { sessionId: getSession } = useIdentity();
  const session = getSession();
  const card = getTrivia(countryCode);

  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

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
  const showReveal = phase.kind === "answered";

  return (
    <div className="rounded-3xl ring-1 ring-yellow/45 shadow-[0_18px_44px_-18px_oklch(72%_0.18_85_/_0.5)] overflow-hidden">
      <div
        className="relative overflow-hidden p-5 flex flex-col gap-4"
        style={{ background: "linear-gradient(160deg, #0c1b53 0%, #19308a 50%, #2c1a72 100%)" }}
      >
        <header className="flex items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-yellow/20 ring-1 ring-yellow/40 text-yellow">
            <Lightbulb className="h-5 w-5" fill="currentColor" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-[0.3em] text-yellow/90 font-display leading-tight">
              {t(lang, "trivia_eyebrow")}
            </p>
            {country && (
              <p className="text-xs text-white/70 leading-snug truncate flex items-center gap-1.5 mt-0.5">
                <HeartFlag code={country.code} size="sm" />
                {countryName(country.code, lang)}
              </p>
            )}
          </div>
        </header>

        <p className="font-display text-base sm:text-lg text-white leading-snug text-balance">
          {block.question}
        </p>

        <ul className="flex flex-col gap-2">
          {block.choices.map((c, i) => {
            const idx = i as TriviaPick;
            const isCorrect = idx === card.correctIndex;
            const isPicked = showReveal && phase.kind === "answered" && phase.choice === idx;
            const tone = !showReveal
              ? "bg-white/[0.08] ring-1 ring-white/15 hover:bg-white/[0.14]"
              : isCorrect
                ? "bg-emerald-500/25 ring-1 ring-emerald-400/55 text-white"
                : isPicked
                  ? "bg-error/25 ring-1 ring-error/55 text-white"
                  : "bg-white/[0.04] ring-1 ring-white/10 text-white/55";
            return (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => submit(idx)}
                  disabled={showReveal}
                  className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition transform-gpu
                              ${tone} ${showReveal ? "" : "active:scale-[0.99]"}`}
                >
                  <span
                    className={`shrink-0 h-7 w-7 grid place-items-center rounded-full text-xs font-display
                                ${showReveal && isCorrect ? "bg-emerald-400 text-dark-blue" : showReveal && isPicked ? "bg-error text-white" : "bg-white/15 text-white/80"}`}
                  >
                    {showReveal && isCorrect ? (
                      <Check className="h-4 w-4" />
                    ) : showReveal && isPicked ? (
                      <X className="h-4 w-4" />
                    ) : (
                      LETTERS[i]
                    )}
                  </span>
                  <span className="text-sm font-display leading-tight">{c}</span>
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
              phase.kind === "answered" && phase.correct ? "text-emerald-300" : "text-white/65"
            }`}
          >
            {phase.kind === "answered" && phase.correct
              ? t(lang, "trivia_answered_correct")
              : t(lang, "trivia_answered_wrong")}
          </motion.p>
        )}
      </div>
    </div>
  );
}
