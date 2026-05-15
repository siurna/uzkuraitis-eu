"use client";

import { useEffect, useRef } from "react";
import { useEventListener } from "@/lib/realtime";
import { ensureSessionId } from "@/lib/use-identity";

// Per-action weights for the avatar mood ring. Tuned so a moderately
// engaged viewer lands in the warm middle of the gradient by mid-show,
// and a fan who reacts/messages/strikes bingo lands in the hot end by
// the climax. Reactions and messages are cheap so they're light;
// bingo strikes + ballot/bets are once-or-twice-a-night actions so
// they're heavier per pop.
const WEIGHTS = {
  chatMessage: 1,
  reactionSent: 0.5,
  reactionReceived: 0.4,
  bingoStrike: 2,
  triviaAnswered: 1,
  voteCast: 5,
  betsSaved: 3,
} as const;

const KEY = (code: string) => `uzk_vibe_${code}`;

function load(code: string): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(KEY(code));
    if (!raw) return 0;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function save(code: string, value: number): void {
  try {
    window.localStorage.setItem(KEY(code), String(Math.round(value * 10) / 10));
  } catch {
    /* localStorage refused (private window etc) — vibe still rides
       in presence for this session, just won't survive reload. */
  }
}

// Watches the same realtime events the rest of the room sees and bumps
// the local viewer's `vibe` score. The score persists to localStorage
// and the room-shell heartbeat reads it on every tick — peers see
// the new value in WhosHere via the REST participants poll. Bumps
// fire for events the local user authored (chat:new with my session
// id, etc) plus in-process actions that don't fan out as broadcasts
// (vote cast, bets saved, trivia answered) which dispatch their own
// custom window events from the call sites.
export function useVibeTracker({ code }: { code: string }) {
  const vibeRef = useRef(load(code));
  const session = useRef(ensureSessionId());

  const bump = (delta: number) => {
    vibeRef.current = Math.max(0, vibeRef.current + delta);
    save(code, vibeRef.current);
  };

  // Realtime side: chat:new (mine), chat:react (mine, plus on my own
  // messages = reactions received). We rely on `message.sessionId` /
  // `message.session` to identify "mine" rather than tracking sent
  // ids — server echoes our own POSTs back so this works either way.
  useEventListener(({ event }) => {
    const ev = event as {
      type?: string;
      id?: string;
      message?: { sessionId?: string; kind?: string };
      session?: string;
    };
    if (ev.type === "chat:new" && ev.message) {
      if (ev.message.sessionId === session.current) {
        bump(
          ev.message.kind === "bingo_strike"
            ? WEIGHTS.bingoStrike
            : WEIGHTS.chatMessage,
        );
      }
    }
    // chat:react: the broadcast doesn't carry the reactor's session in
    // every variant, so we listen to a parallel local window event
    // (uzk:vibe-bump) dispatched at the call site for actions we know
    // are ours. The broadcast handler stays narrow to avoid
    // double-counting.
  });

  // Window events for the actions that don't ride the realtime
  // broadcast path (votes, bets, trivia, local reaction sends).
  useEffect(() => {
    const onBump = (e: Event) => {
      const detail = (e as CustomEvent).detail as { kind?: string } | undefined;
      const kind = detail?.kind;
      if (!kind) return;
      const w = WEIGHTS[kind as keyof typeof WEIGHTS];
      if (w) bump(w);
    };
    window.addEventListener("uzk:vibe-bump", onBump);
    return () => window.removeEventListener("uzk:vibe-bump", onBump);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

// Call-site helper: keeps the dispatch one line at the call site
// without leaking the event name + custom-event boilerplate.
export function bumpVibe(kind: keyof typeof WEIGHTS): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("uzk:vibe-bump", { detail: { kind } }));
}
