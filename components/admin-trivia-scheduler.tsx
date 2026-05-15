"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Lightbulb, Loader2, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
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
// button. Bypassing the dedup pops a quick confirm drawer; tapping
// "Resend now" fires the trivia IMMEDIATELY — no fresh timer. "Again"
// is for glitch recovery (first card didn't land), so making the
// admin wait another 30s+ for a redo is the wrong default.
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
  // lastFired starts as null on both server + client so the first
  // render is hydration-stable; the localStorage read runs in an
  // effect below and the nowPlayingCode effect re-evaluates whenever
  // lastFired changes so a late-loading dedup hit still cancels the
  // armed timer (see the effect below for the late-cancel branch).
  const [lastFired, setLastFired] = useState<string | null>(null);
  useEffect(() => {
    try {
      const v = localStorage.getItem(LAST_FIRED_KEY);
      if (v) setLastFired(v);
    } catch {
      /* localStorage blocked / private mode */
    }
  }, []);
  const [confirmResend, setConfirmResend] = useState(false);
  const lastScheduled = useRef<string | null>(null);

  // Arm a timer when nowPlayingCode changes, UNLESS the new country
  // matches the last successfully-fired one. lastFired loads from
  // localStorage in a post-mount effect (above) for SSR-stability, so
  // this effect can run BEFORE the dedup data has arrived; we re-run
  // on every lastFired change to cover the late-arrival case.
  useEffect(() => {
    if (!nowPlayingCode) {
      setTarget(null);
      lastScheduled.current = null;
      return;
    }
    // Dedup re-check on every render (incl. the one right after
    // lastFired hydrates from localStorage). Cancels any armed
    // timer if it turns out the dedup hit applies.
    if (nowPlayingCode === lastFired) {
      setTarget(null);
      lastScheduled.current = nowPlayingCode;
      return;
    }
    if (lastScheduled.current === nowPlayingCode) return;
    lastScheduled.current = nowPlayingCode;
    armFresh(nowPlayingCode);
  }, [nowPlayingCode, lastFired]);

  const armFresh = (code: string) => {
    const delay =
      TRIVIA_MIN_MS + Math.floor(Math.random() * (TRIVIA_MAX_MS - TRIVIA_MIN_MS));
    setTarget({ code, firesAt: Date.now() + delay });
  };

  // Shared POST → /api/admin/live/trivia. Both the timer-fire effect
  // below and the immediate resend path call this so the network +
  // localStorage stamping live in one place. firingRef guards
  // SYNCHRONOUSLY: if the timer expires the same tick the admin taps
  // "Resend now", both call sites can pass the `firing` STATE gate
  // (state updates are async) but only one wins the ref. We also
  // clear `target` up-front so a still-armed timer can't fire a
  // second time after this call resolves.
  const firingRef = useRef(false);
  const fireCard = useCallback(async (code: string) => {
    if (firingRef.current) return;
    firingRef.current = true;
    setTarget(null);
    lastScheduled.current = code;
    setFiring(true);
    try {
      const res = await fetch("/api/admin/live/trivia", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ countryCode: code }),
      });
      // Surface the fan-out result so a silent zero-room fire (no
      // room has BOTH this country on stage AND triviaEnabled, or
      // the country lacks a question in the deck) is debuggable.
      // The endpoint returns `{ fired: N }` on success.
      if (res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { fired?: number }
          | null;
        const fired = data?.fired ?? 0;
        if (fired > 0) {
          toast.success(`Trivia fanned out to ${fired} room${fired === 1 ? "" : "s"}.`);
        } else {
          toast.warning("Trivia fired but no rooms received it. Check that trivia is enabled and the country is on stage.");
        }
      } else {
        toast.error(`Trivia fire failed (${res.status}).`);
      }
      try {
        localStorage.setItem(LAST_FIRED_KEY, code);
      } catch {
        /* private mode / quota */
      }
      setLastFired(code);
    } catch {
      toast.error("Trivia fire request failed. Network blip?");
    } finally {
      firingRef.current = false;
      setFiring(false);
    }
  }, []);

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
    const code = target.code;
    setTarget(null);
    fireCard(code);
  }, [target, now, firing, fireCard]);

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

  // Resend NOW. Triggered from the confirm drawer. The dedup banner
  // exists for glitch recovery — the first card didn't land in chat,
  // the admin needs to retry. Making them sit through another 30s+
  // random timer would defeat the point, so this fires immediately.
  // Doesn't clear lastFired (so the NEXT distinct country change
  // still runs through the normal armed-timer path).
  const resendNow = () => {
    setConfirmResend(false);
    if (!nowPlayingCode) return;
    fireCard(nowPlayingCode);
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
        <span className="shrink-0 grid place-items-center h-9 w-9 uzk-icon-squircle bg-yellow/15 ring-1 ring-yellow/30 text-yellow">
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
              Fired for{" "}
              <span className="font-display text-yellow">
                {countryName(nowPlayingCode!, "en") ?? nowPlayingCode}
              </span>
              . Card didn't land? Resend.
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
        title="Resend trivia card?"
        sub={
          nowPlayingCode
            ? `Use this if the first ${countryName(nowPlayingCode, "en") ?? nowPlayingCode} trivia card didn't actually land in chat (glitch / network blip).`
            : "Use this if the first card didn't actually land in chat."
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
              onClick={resendNow}
              className="bg-flamingo text-white hover:bg-flamingo/90 rounded-2xl"
            >
              Resend now
            </Button>
          </>
        }
      >
        <p className="text-sm text-white/65 leading-relaxed">
          Fires immediately, no fresh timer. If the original card did land
          and players already answered, viewers will see a second card
          drop right under the first one.
        </p>
      </BottomSheet>
    </>
  );
}
