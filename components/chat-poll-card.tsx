"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { Crown } from "lucide-react";
import { useIdentity } from "@/lib/use-identity";
import { useRoomLive } from "@/components/room-shell";
import { FluentEmoji } from "@/components/fluent-emoji";
import { t } from "@/lib/i18n";
import type { Language } from "@/lib/i18n";
import type { Reactions } from "@/components/chat-row";

// Inline "vibe check" poll. Votes ride on top of the existing
// chat_reactions table (one reaction = one vote, single-choice
// enforced client-side by toggling the prior pick off first), so
// the chat:react broadcast keeps the bars in sync for every viewer
// without a new event type or table.
//
// Optimistic update: the tap commits to the local view immediately
// — bar slides, mine/leader recompute — and the network call fires
// in the background. The override clears when the chat:react
// broadcast round-trips back and the server-authored reactions
// reflect the same pick. Avoids the "I tapped, nothing happened
// for a second" feel that used to land while two POSTs + a
// broadcast + a refetch played out.

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

  const question = (meta?.question?.[lang] ?? meta?.question?.en ?? "") as string;
  const choices = useMemo<PollChoice[]>(
    () => (Array.isArray(meta?.choices) ? meta!.choices! : []),
    [meta],
  );

  // What the server says this session picked.
  const serverMyEmoji = useMemo(() => {
    for (const c of choices) {
      if (reactions[c.emoji]?.mine) return c.emoji;
    }
    return null;
  }, [choices, reactions]);

  // Pending local override (null inside the box = "I undid my vote";
  // unset state = no override). Clears the moment the server-authored
  // reactions reflect the same pick.
  const [override, setOverride] = useState<{ emoji: string | null } | null>(null);
  useEffect(() => {
    if (!override) return;
    if (override.emoji === serverMyEmoji) setOverride(null);
  }, [serverMyEmoji, override]);

  const myEmoji = override ? override.emoji : serverMyEmoji;

  // Per-choice count adjusted for the optimistic override so the bars
  // animate the instant the user taps.
  const countFor = useCallback(
    (emoji: string) => {
      let c = reactions[emoji]?.count ?? 0;
      if (override) {
        if (serverMyEmoji === emoji && override.emoji !== emoji) c -= 1;
        if (override.emoji === emoji && override.emoji !== serverMyEmoji) c += 1;
      }
      return Math.max(0, c);
    },
    [reactions, override, serverMyEmoji],
  );

  const tally = useMemo(() => {
    let total = 0;
    let max = 0;
    let leader: string | null = null;
    for (const c of choices) {
      const n = countFor(c.emoji);
      total += n;
      if (n > max) {
        max = n;
        leader = c.emoji;
      }
    }
    return { total, leader, safe: Math.max(total, 1) };
  }, [choices, countFor]);

  // Serialise actual POSTs so a fast double-tap doesn't fire two
  // inserts on top of each other before the server reconciles. The
  // UI itself still updates synchronously via the override; this
  // only gates the network layer.
  const inflight = useRef<Promise<unknown> | null>(null);

  const vote = useCallback(
    (emoji: string) => {
      if (!code) return;
      const session = getSession();
      const senderName = (name ?? "").trim() || "anonymous";
      // Effective next pick: tapping your current choice undoes it,
      // anything else replaces.
      const nextPick = myEmoji === emoji ? null : emoji;
      setOverride({ emoji: nextPick });

      const post = (e: string) =>
        fetch(`/api/rooms/${code}/chat/${messageId}/react`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ session, name: senderName, emoji: e }),
        });

      const run = async () => {
        // Wait for any prior tap's network round to finish so its
        // delete/insert order isn't trampled.
        if (inflight.current) {
          try { await inflight.current; } catch { /* swallow */ }
        }
        const calls: Promise<unknown>[] = [];
        if (serverMyEmoji && serverMyEmoji !== nextPick) calls.push(post(serverMyEmoji));
        if (nextPick && nextPick !== serverMyEmoji) calls.push(post(nextPick));
        await Promise.all(calls);
      };
      const p = run().catch(() => {
        // Network blip — let the next broadcast-driven refetch
        // reconcile and drop the override.
      });
      inflight.current = p;
      p.finally(() => {
        if (inflight.current === p) inflight.current = null;
      });
    },
    [code, getSession, name, messageId, myEmoji, serverMyEmoji],
  );

  if (!meta?.poll || choices.length === 0) return null;
  const voted = myEmoji != null;

  return (
    <div className="rounded-3xl ring-1 ring-white/15 shadow-[0_24px_48px_-22px_oklch(45%_0.2_336_/_0.55)] overflow-hidden">
      <div
        className="relative overflow-hidden px-5 pt-5 pb-4 flex flex-col gap-4"
        style={{
          background:
            "radial-gradient(120% 90% at 10% 0%, oklch(58% 0.22 336 / 0.42) 0%, transparent 55%), radial-gradient(120% 100% at 90% 100%, oklch(70% 0.18 200 / 0.32) 0%, transparent 60%), linear-gradient(155deg, #1a0f2d 0%, #2a1664 50%, #0b1444 100%)",
        }}
      >
        {/* Subtle moving spotlight behind the choices — keeps the
            card "alive" between vote events without crossing into
            casino-flashy. Pure CSS, GPU-cheap. */}
        <span
          aria-hidden
          className="pointer-events-none absolute -inset-32 opacity-40 motion-safe:[animation:poll-shine_18s_linear_infinite]"
          style={{
            background:
              "conic-gradient(from 0deg, transparent 0deg, oklch(80% 0.15 200 / 0.18) 30deg, transparent 60deg, transparent 360deg)",
          }}
        />

        <header className="relative flex flex-col gap-1">
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/75 font-display leading-tight">
            {t(lang, "poll_eyebrow")}
          </p>
          <p className="font-display text-base sm:text-lg text-white leading-snug text-balance">
            {question}
          </p>
        </header>

        <ul className="relative flex flex-col gap-2">
          {choices.map((c, i) => {
            const count = countFor(c.emoji);
            const pct = (count / tally.safe) * 100;
            const mine = myEmoji === c.emoji;
            const isLeader = voted && tally.leader === c.emoji && tally.total > 0;
            return (
              <li key={c.emoji}>
                <motion.button
                  type="button"
                  onClick={() => vote(c.emoji)}
                  aria-pressed={mine}
                  whileTap={{ scale: 0.985 }}
                  animate={mine ? { scale: [1, 1.03, 1] } : { scale: 1 }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  initial={{ opacity: 0, y: 4 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className={`group relative w-full overflow-hidden rounded-2xl px-3 py-2.5 text-left
                              transition-colors transform-gpu
                              ${mine
                                ? "bg-white/[0.22] ring-1 ring-white/55"
                                : "bg-white/[0.08] ring-1 ring-white/15 hover:bg-white/[0.14]"}`}
                  style={{ animationDelay: `${i * 0.04}s` }}
                >
                  {/* Tally bar fills behind the row. Gold-tinted for
                      the leader, white for the picked, faded for
                      everyone else. Spring transition feels alive
                      when votes land. (The earlier `inset` shadow
                      halo painted a dark stripe inside the bar's
                      trailing edge — read as random padding inside
                      the fill — so it's gone; the gradient itself
                      carries enough depth.) */}
                  <motion.span
                    className={`absolute inset-y-0 left-0 origin-left
                                ${isLeader
                                  ? "bg-gradient-to-r from-yellow/55 to-yellow/30"
                                  : mine
                                    ? "bg-gradient-to-r from-white/40 to-white/15"
                                    : "bg-white/15"}`}
                    initial={false}
                    animate={{ width: `${voted ? pct : 0}%` }}
                    transition={{ type: "spring", stiffness: 180, damping: 26 }}
                    aria-hidden
                  />
                  <span className="relative flex items-center gap-3">
                    <motion.span
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-black/35 ring-1 ring-white/15"
                      animate={mine ? { rotate: [0, -8, 6, 0] } : {}}
                      transition={{ duration: 0.45, ease: "easeOut" }}
                    >
                      <FluentEmoji glyph={c.emoji} size={28} />
                    </motion.span>
                    <span className="flex-1 min-w-0 flex items-center gap-2">
                      <span className="font-display text-sm sm:text-base text-white truncate">
                        {(c[lang] ?? c.en) || c.emoji}
                      </span>
                      {isLeader && (
                        <Crown
                          className="h-3.5 w-3.5 text-yellow shrink-0"
                          fill="currentColor"
                          aria-label="leading"
                        />
                      )}
                    </span>
                    {voted ? (
                      <span className="shrink-0 inline-flex items-baseline gap-1 font-display tabular-nums text-white/95">
                        <motion.span
                          key={count}
                          initial={{ y: -2, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          transition={{ duration: 0.22 }}
                          className="text-base"
                        >
                          {Math.round(pct)}%
                        </motion.span>
                        <span className="text-[10px] uppercase tracking-wider text-white/55">
                          {count}
                        </span>
                      </span>
                    ) : (
                      <span className="shrink-0 text-[10px] uppercase tracking-[0.22em] text-white/45 font-display">
                        {t(lang, "poll_tap")}
                      </span>
                    )}
                  </span>
                </motion.button>
              </li>
            );
          })}
        </ul>

        <footer className="relative flex items-center justify-between">
          <p className="text-[11px] text-white/65 leading-snug">
            {voted ? t(lang, "poll_voted", tally.total) : t(lang, "poll_prompt")}
          </p>
          {voted && (
            <button
              type="button"
              onClick={() => myEmoji && vote(myEmoji)}
              className="text-[10px] uppercase tracking-[0.18em] text-white/45 font-display hover:text-white/75 transition"
            >
              {t(lang, "poll_undo")}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
