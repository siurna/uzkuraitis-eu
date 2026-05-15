"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Lightbulb, Loader2, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { countryName } from "@/lib/countries";

// Admin-side trivia scheduler. When a country goes on stage a random
// 30s–2:30 timer arms; when it pops we POST to /api/admin/live/trivia
// and the server fans the card to every room that has that country
// on stage + triviaEnabled. localStorage dedup so re-advancing to the
// same country doesn't auto-refire — the admin must explicitly resend
// (immediate, no fresh timer). beforeunload prompt while a timer is
// pending so the scheduler can't disappear mid-song.

const MIN_MS = 30_000;
const MAX_MS = 150_000;
const TICK_MS = 1000;
const KEY = "uzk_admin_trivia_last";

export function AdminTriviaScheduler({
  nowPlayingCode,
}: {
  nowPlayingCode: string | null;
}) {
  const [target, setTarget] = useState<{ code: string; firesAt: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [firing, setFiring] = useState(false);
  const [confirmResend, setConfirmResend] = useState(false);
  // null on SSR + first client paint (hydration-stable); loaded below.
  const [lastFired, setLastFired] = useState<string | null>(null);
  // The code we've already handled this mount (armed, fired, or
  // cancelled). Keeps the arm-effect idempotent so a late-arriving
  // lastFired re-run, a cancel, or a fire all settle into a stable
  // state without re-arming the timer.
  const handledRef = useRef<string | null>(null);
  // Sync mutex on the network call — prevents the timer-fire path
  // and a same-tick resend tap from double-posting.
  const firingRef = useRef(false);

  useEffect(() => {
    try {
      setLastFired(localStorage.getItem(KEY));
    } catch {
      /* private mode */
    }
  }, []);

  // POST → /api/admin/live/trivia. Used by both the timer-fire effect
  // and the immediate resend path. Surfaces the fan-out count so a
  // silent 0-room fire (country off-stage / trivia disabled / no deck
  // entry) is visible to the admin instead of looking like a no-op.
  const fireCard = useCallback(async (code: string) => {
    if (firingRef.current) return;
    firingRef.current = true;
    setTarget(null);
    setFiring(true);
    try {
      const res = await fetch("/api/admin/live/trivia", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ countryCode: code }),
      });
      if (!res.ok) {
        toast.error(`Trivia fire failed (${res.status}).`);
        return;
      }
      const { fired = 0 } = (await res.json().catch(() => ({}))) as { fired?: number };
      if (fired > 0) {
        toast.success(`Trivia fanned out to ${fired} room${fired === 1 ? "" : "s"}.`);
      } else {
        toast.warning(
          "Trivia fired but no rooms received it. Check trivia is on + the country is still on stage.",
        );
      }
      try {
        localStorage.setItem(KEY, code);
      } catch {
        /* private mode */
      }
      setLastFired(code);
    } catch {
      toast.error("Trivia fire request failed. Network blip?");
    } finally {
      firingRef.current = false;
      setFiring(false);
    }
  }, []);

  // Arm when a new country goes on stage. Skip if we already fired for
  // it (lastFired matches) or we've already handled it this mount
  // (handledRef matches — covers the late-arriving lastFired re-run +
  // a cancelled timer that would otherwise immediately re-arm).
  useEffect(() => {
    if (!nowPlayingCode) {
      setTarget(null);
      handledRef.current = null;
      return;
    }
    if (nowPlayingCode === lastFired) {
      setTarget(null);
      handledRef.current = nowPlayingCode;
      return;
    }
    if (handledRef.current === nowPlayingCode) return;
    handledRef.current = nowPlayingCode;
    const delay = MIN_MS + Math.floor(Math.random() * (MAX_MS - MIN_MS));
    setTarget({ code: nowPlayingCode, firesAt: Date.now() + delay });
  }, [nowPlayingCode, lastFired]);

  // Countdown clock — runs only while a target is pending.
  useEffect(() => {
    if (!target) return;
    const id = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(id);
  }, [target]);

  // Fire when target time arrives.
  useEffect(() => {
    if (!target) return;
    if (now < target.firesAt) return;
    fireCard(target.code);
  }, [target, now, fireCard]);

  // beforeunload while a timer is pending.
  useEffect(() => {
    if (!target) return;
    const onUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [target]);

  const remaining = target ? Math.max(0, target.firesAt - now) : 0;
  const mm = Math.floor(remaining / 60_000).toString().padStart(2, "0");
  const ss = Math.floor((remaining % 60_000) / 1000).toString().padStart(2, "0");

  const dedup = !!nowPlayingCode && nowPlayingCode === lastFired && !target && !firing;
  const resendNow = () => {
    setConfirmResend(false);
    if (nowPlayingCode) fireCard(nowPlayingCode);
  };

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
          ) : dedup ? (
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
            onClick={() => setTarget(null)}
            className="shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-lg bg-white/[0.04] ring-1 ring-white/10 text-white/65 hover:bg-white/[0.08]"
            aria-label="Cancel pending trivia"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        {dedup && (
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
