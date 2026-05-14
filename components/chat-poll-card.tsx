"use client";

import { useCallback, useMemo, useState } from "react";
import { motion } from "motion/react";
import { BarChart3, Loader2 } from "lucide-react";
import { useIdentity } from "@/lib/use-identity";
import { useRoomLive } from "@/components/room-shell";
import { t } from "@/lib/i18n";
import type { Language } from "@/lib/i18n";
import type { Reactions } from "@/components/chat-row";

// Inline "vibe check" poll. The host fires it from admin broadcasts;
// the server inserts a chat message with kind="poll" and the question
// + 4 emoji choices baked into meta. Votes ride on top of the existing
// chat_reactions table (one reaction per choice = one vote), so the
// existing chat:react broadcast keeps the tally bars in sync across
// every viewer for free.
//
// Single-choice is enforced client-side: tapping a different option
// toggles the previous reaction off first, then adds the new one. Mild
// race-condition risk if a second tap lands mid-flight; the
// `submitting` guard plus the existing toggle endpoint converges
// state correctly on the next refetch.

type PollChoice = { emoji: string; en: string; lt: string };

type PollMeta = {
  poll?: boolean;
  question?: { en?: string; lt?: string };
  choices?: PollChoice[];
};

export function ChatPollCard({
  messageId,
  meta,
  reactions,
  lang,
}: {
  messageId: string;
  meta: PollMeta | null;
  reactions: Reactions;
  lang: Language;
}) {
  const { sessionId: getSession, name } = useIdentity();
  const { code } = useRoomLive();
  const [submitting, setSubmitting] = useState<string | null>(null);

  const question = (meta?.question?.[lang] ?? meta?.question?.en ?? "") as string;
  const choices = useMemo<PollChoice[]>(
    () => (Array.isArray(meta?.choices) ? meta!.choices! : []),
    [meta],
  );

  // Tallies + which emoji this session already picked. `reactions` is
  // the same shape chat-row uses for every other message, so the
  // chat:react broadcast already keeps us live.
  const tallies = useMemo(() => {
    const total = choices.reduce((n, c) => n + (reactions[c.emoji]?.count ?? 0), 0);
    return { total, total_safe: Math.max(total, 1) };
  }, [choices, reactions]);

  const myEmoji = useMemo(() => {
    for (const c of choices) {
      if (reactions[c.emoji]?.mine) return c.emoji;
    }
    return null;
  }, [choices, reactions]);

  const vote = useCallback(
    async (emoji: string) => {
      if (submitting || !code) return;
      // Re-tap your current choice → undo it (poll endpoint toggles,
      // so a second tap on the same emoji clears your vote).
      const session = getSession();
      const senderName = (name ?? "").trim() || "anonymous";
      setSubmitting(emoji);
      try {
        // If switching, drop the prior reaction first so we don't
        // end up with multiple "mine" rows on the same message. The
        // react endpoint is a toggle, so a fresh POST adds it back
        // for the new choice below.
        if (myEmoji && myEmoji !== emoji) {
          await fetch(`/api/rooms/${code}/chat/${messageId}/react`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ session, name: senderName, emoji: myEmoji }),
          });
        }
        await fetch(`/api/rooms/${code}/chat/${messageId}/react`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ session, name: senderName, emoji }),
        });
      } catch {
        /* live tally rebroadcast will reconcile next refetch */
      } finally {
        setSubmitting(null);
      }
    },
    [submitting, code, myEmoji, getSession, name, messageId],
  );

  if (!meta?.poll || choices.length === 0) return null;
  const voted = myEmoji != null;

  return (
    <div className="rounded-3xl ring-1 ring-fuchsia/45 shadow-[0_18px_44px_-18px_oklch(58%_0.24_335_/_0.5)] overflow-hidden">
      <div
        className="relative overflow-hidden p-5 flex flex-col gap-4"
        style={{ background: "linear-gradient(150deg, #2a17e6 0%, #6020c6 45%, #c91475 100%)" }}
      >
        <header className="flex items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/15 ring-1 ring-white/25 text-white">
            <BarChart3 className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-[0.3em] text-white/85 font-display leading-tight">
              {t(lang, "poll_eyebrow")}
            </p>
            <p className="font-display text-base sm:text-lg text-white leading-snug mt-0.5 text-balance">
              {question}
            </p>
          </div>
        </header>

        <ul className="flex flex-col gap-2">
          {choices.map((c) => {
            const count = reactions[c.emoji]?.count ?? 0;
            const pct = (count / tallies.total_safe) * 100;
            const mine = myEmoji === c.emoji;
            const busy = submitting === c.emoji;
            return (
              <li key={c.emoji}>
                <button
                  type="button"
                  onClick={() => vote(c.emoji)}
                  disabled={submitting != null}
                  aria-pressed={mine}
                  className={`relative w-full overflow-hidden rounded-xl px-3 py-2.5 text-left
                              transition transform-gpu active:scale-[0.99]
                              ${mine
                                ? "bg-white/[0.18] ring-1 ring-white/55"
                                : "bg-white/[0.06] ring-1 ring-white/15 hover:bg-white/[0.12]"}`}
                >
                  {/* The tally bar fills behind the row — narrow when
                      nobody's picked it, wide when most of the room
                      has. Lighter on the leader so the eye lands on
                      it first. */}
                  <motion.span
                    className={`absolute inset-y-0 left-0 ${mine ? "bg-white/30" : "bg-white/15"}`}
                    initial={false}
                    animate={{ width: `${voted ? pct : 0}%` }}
                    transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                    aria-hidden
                  />
                  <span className="relative flex items-center gap-3">
                    <span className="text-2xl leading-none shrink-0">{c.emoji}</span>
                    <span className="flex-1 min-w-0 text-sm sm:text-base font-display text-white truncate">
                      {(c[lang] ?? c.en) || c.emoji}
                    </span>
                    {voted ? (
                      <span className="shrink-0 text-xs font-display tabular-nums text-white/90">
                        {count} ({Math.round(pct)}%)
                      </span>
                    ) : busy ? (
                      <Loader2 className="h-4 w-4 text-white/80 animate-spin shrink-0" />
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <p className="text-[11px] text-white/70 leading-snug">
          {voted
            ? t(lang, "poll_voted", tallies.total)
            : t(lang, "poll_prompt")}
        </p>
      </div>
    </div>
  );
}
