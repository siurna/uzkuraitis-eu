"use client";

import { useEffect, useRef, useState } from "react";
import { Lightbulb, Loader2, X } from "lucide-react";

// Admin-side trivia scheduler. The global live panel is the source of
// truth for "country on stage right now" — when that flips, this
// component starts a random 30s–2:30 timer. When it fires, we POST
// to /api/admin/live/trivia which fans the trivia card out to every
// room that has triviaEnabled=true.
//
// Why client-side: Vercel functions can't hold a 90s+ timer past
// their response. The admin's tab is always open during the show
// anyway (they're running it), so we put the scheduler there.
//
// beforeunload warning: while a timer is pending we wire a
// beforeunload handler so closing the tab pops the browser's "are
// you sure" dialog — losing the scheduler mid-song would mean no
// trivia for whoever's on stage.

const TRIVIA_MIN_MS = 30 * 1000;       // :30
const TRIVIA_MAX_MS = 2 * 60_000 + 30_000; // 2:30
// Polled clock for the countdown — 1s is enough granularity.
const TICK_MS = 1000;

export function AdminTriviaScheduler({
  nowPlayingCode,
}: {
  nowPlayingCode: string | null;
}) {
  const [target, setTarget] = useState<{
    code: string;
    firesAt: number;
  } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [firing, setFiring] = useState(false);
  // Snapshot the last code we scheduled for so we don't re-schedule
  // on re-renders that happen to keep the same nowPlayingCode.
  const lastScheduled = useRef<string | null>(null);

  // Reschedule when the on-stage country changes. Null nowPlaying
  // (break / not started / ended) cancels any pending timer.
  useEffect(() => {
    if (!nowPlayingCode) {
      setTarget(null);
      lastScheduled.current = null;
      return;
    }
    if (lastScheduled.current === nowPlayingCode) return;
    lastScheduled.current = nowPlayingCode;
    const delay =
      TRIVIA_MIN_MS + Math.floor(Math.random() * (TRIVIA_MAX_MS - TRIVIA_MIN_MS));
    setTarget({ code: nowPlayingCode, firesAt: Date.now() + delay });
  }, [nowPlayingCode]);

  // Countdown clock — 1s tick, only running while there's a target.
  useEffect(() => {
    if (!target) return;
    const id = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(id);
  }, [target]);

  // Fire when target time arrives. The fetch is fire-and-forget on
  // success; on failure we clear the target so a retry isn't
  // hammered every tick.
  useEffect(() => {
    if (!target || firing) return;
    if (now < target.firesAt) return;
    setFiring(true);
    const code = target.code;
    setTarget(null);
    (async () => {
      try {
        await fetch("/api/admin/live/trivia", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ countryCode: code }),
        });
      } catch {
        /* admin can re-pick the country to retry */
      } finally {
        setFiring(false);
      }
    })();
  }, [target, now, firing]);

  // beforeunload guard while a timer is pending. The browser
  // standardises the prompt; the message text we set is mostly
  // ignored, but the empty `returnValue` is what triggers the dialog.
  useEffect(() => {
    if (!target) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [target]);

  const remaining = target ? Math.max(0, target.firesAt - now) : 0;
  const mm = Math.floor(remaining / 60_000)
    .toString()
    .padStart(2, "0");
  const ss = Math.floor((remaining % 60_000) / 1000)
    .toString()
    .padStart(2, "0");

  const cancel = () => {
    setTarget(null);
    lastScheduled.current = null;
  };

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white/[0.03] ring-1 ring-white/8 px-3 py-2.5">
      <span className="shrink-0 grid place-items-center h-9 w-9 rounded-lg bg-yellow/15 ring-1 ring-yellow/30 text-yellow">
        <Lightbulb className="h-4 w-4" fill="currentColor" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-display text-sm text-white truncate">Trivia scheduler</p>
        {target ? (
          <p className="text-[11px] text-white/55 leading-snug">
            Drops a trivia card to all subscribed rooms in{" "}
            <span className="font-display text-yellow tabular-nums">
              {mm}:{ss}
            </span>
            .
          </p>
        ) : firing ? (
          <p className="text-[11px] text-emerald-300/85 leading-snug inline-flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" />
            Firing now.
          </p>
        ) : (
          <p className="text-[11px] text-white/45 leading-snug">
            Idle. Put a country on stage to arm a new timer.
          </p>
        )}
      </div>
      {target && (
        <button
          type="button"
          onClick={cancel}
          className="shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-lg bg-white/[0.04] ring-1 ring-white/10 text-white/65 hover:bg-white/[0.08]"
          aria-label="Cancel pending trivia"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
