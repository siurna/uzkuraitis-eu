"use client";

import { useEffect, useRef, useState } from "react";
import { Lightbulb, Loader2, RotateCcw, X } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { countryName } from "@/lib/countries";

// Admin-side trivia scheduler. The global live panel is the source of
// truth for "country on stage right now" — when that flips, this
// component starts a random 30s–2:30 timer. When it fires, we POST
// to /api/admin/live/trivia which fans the trivia card out to every
// room that has triviaEnabled=true.
//
// Dedup: the last country we successfully fired for is stamped in
// localStorage (LAST_FIRED_KEY). If the admin advances back to the
// same country (e.g. a rehearsal loop, an accidental re-tap), the
// scheduler refuses to re-arm and surfaces a "send again anyway"
// button that opens a confirm drawer. Bypassing the dedup requires
// a deliberate confirm tap; nobody double-fires by accident.
//
// beforeunload warning: while a timer is pending we wire a
// beforeunload handler so closing the tab pops the browser's "are
// you sure" dialog — losing the scheduler mid-song would mean no
// trivia for whoever's on stage.

const TRIVIA_MIN_MS = 30 * 1000;       // :30
const TRIVIA_MAX_MS = 2 * 60_000 + 30_000; // 2:30
const TICK_MS = 1000;
const LAST_FIRED_KEY = "uzk_admin_trivia_last";

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
  // Read lastFired SYNCHRONOUSLY on first render. The previous version
  // populated this in a post-mount useEffect, so on first mount the
  // dedup check (in the nowPlayingCode effect below) saw lastFired
  // as null and ALWAYS armed the timer regardless of whether the
  // same country had already been fired in this browser. By the time
  // the localStorage read landed and triggered a re-run, the
  // lastScheduled ref had already latched, blocking the re-evaluation.
  // Lazy initialiser fixes the race once and for all.
  const [lastFired, setLastFired] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return localStorage.getItem(LAST_FIRED_KEY);
    } catch {
      return null;
    }
  });
  const [confirmResend, setConfirmResend] = useState(false);
  const lastScheduled = useRef<string | null>(null);

  // Arm a timer when nowPlayingCode changes, UNLESS the new country
  // matches the last successfully-fired one. The lastScheduled ref
  // dedupes RE-runs of this effect for the SAME country (e.g. when
  // lastFired changes, the deps re-fire). The localStorage check is
  // already correct from first render (lazy initialiser above).
  useEffect(() => {
    if (!nowPlayingCode) {
      setTarget(null);
      lastScheduled.current = null;
      return;
    }
    if (lastScheduled.current === nowPlayingCode) return;
    lastScheduled.current = nowPlayingCode;
    if (nowPlayingCode === lastFired) {
      // Dedup hit. Don't arm; UI shows the resend affordance.
      setTarget(null);
      return;
    }
    armFresh(nowPlayingCode);
  }, [nowPlayingCode, lastFired]);

  const armFresh = (code: string) => {
    const delay =
      TRIVIA_MIN_MS + Math.floor(Math.random() * (TRIVIA_MAX_MS - TRIVIA_MIN_MS));
    setTarget({ code, firesAt: Date.now() + delay });
  };

  // Countdown clock — 1s tick, only running while there's a target.
  useEffect(() => {
    if (!target) return;
    const id = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(id);
  }, [target]);

  // Fire when target time arrives.
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
        // Stamp the country as last-fired so a re-arm on the same
        // country doesn't fire-and-forget another card.
        try {
          localStorage.setItem(LAST_FIRED_KEY, code);
        } catch {
          /* ignore */
        }
        setLastFired(code);
      } catch {
        /* admin can re-pick the country to retry */
      } finally {
        setFiring(false);
      }
    })();
  }, [target, now, firing]);

  // beforeunload guard while a timer is pending.
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

  // Send again anyway: triggered from the confirm drawer. Skips the
  // dedup check + arms a fresh timer. Doesn't clear lastFired so the
  // dedup still works on the NEXT distinct country change.
  const resendAnyway = () => {
    setConfirmResend(false);
    if (!nowPlayingCode) return;
    armFresh(nowPlayingCode);
  };

  // Three render states, in priority order:
  //   1. Pending timer (target set)          → countdown + cancel X
  //   2. Same-country dedup, no timer        → "already fired" + resend
  //   3. Firing                              → spinner
  //   4. Idle                                → muted hint
  const dedupedSameCountry =
    !!nowPlayingCode && nowPlayingCode === lastFired && !target && !firing;

  return (
    <>
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
          ) : dedupedSameCountry ? (
            <p className="text-[11px] text-white/55 leading-snug">
              Already fired for{" "}
              <span className="font-display text-yellow">
                {countryName(nowPlayingCode!, "en") ?? nowPlayingCode}
              </span>
              . Send again anyway?
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
        {dedupedSameCountry && (
          <button
            type="button"
            onClick={() => setConfirmResend(true)}
            className="shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-lg bg-flamingo/15 ring-1 ring-flamingo/40 text-flamingo hover:bg-flamingo/25"
            aria-label="Send trivia again"
            title="Send trivia again"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <BottomSheet
        open={confirmResend}
        onClose={() => setConfirmResend(false)}
        title="Send trivia again?"
        sub={
          nowPlayingCode
            ? `${countryName(nowPlayingCode, "en") ?? nowPlayingCode} already got a trivia card this round. Two cards back-to-back can read as a bug to viewers.`
            : ""
        }
        footer={
          <>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirmResend(false)}
              className="text-white/70"
            >
              Cancel
            </Button>
            <div className="flex-1" />
            <Button
              type="button"
              onClick={resendAnyway}
              className="bg-flamingo text-white hover:bg-flamingo/90 rounded-2xl"
            >
              Send again anyway
            </Button>
          </>
        }
      >
        <p className="text-sm text-white/65 leading-relaxed">
          A fresh 30s–2:30 timer arms the moment you confirm. The viewers
          will see a second trivia card drop in chat for the same
          country.
        </p>
      </BottomSheet>
    </>
  );
}
