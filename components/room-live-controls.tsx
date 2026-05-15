"use client";

import { useState, useTransition } from "react";
import { Clock, Mic, Pause, Flag as FlagIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { HeartFlag } from "@/components/flag";
import { countries } from "@/lib/countries";

// Live show controls — the "running it from the back" panel. Status
// pills + (when in-progress) the full country list to tap-flip who's
// on stage. The caller supplies an `apply` callback so the same panel
// works for:
//   - the magic-link host page  → PATCH /api/rooms/[code]/manage
//   - the global /admin/live    → POST /api/admin/live (all rooms)
export type ShowStatus = "not_started" | "in_progress" | "break" | "ended";

export type LivePatch = {
  showStatus?: ShowStatus;
  nowPlayingCode?: string | null;
};

// Icon choices: each status reads at a glance. Clock = doors not open
// yet, Mic = act on stage, Pause = scheduled interval, Flag = checkered
// finish. We avoid using Pause for both not-started and break (which
// were the old pair and confusable).
const STATUS_DEFS: { id: ShowStatus; label: string; Icon: typeof Pause }[] = [
  { id: "not_started", label: "Not started", Icon: Clock },
  { id: "in_progress", label: "In progress", Icon: Mic },
  { id: "break", label: "Break", Icon: Pause },
  { id: "ended", label: "Ended", Icon: FlagIcon },
];

export function RoomLiveControls({
  initialStatus,
  initialNowPlaying,
  apply,
}: {
  initialStatus: ShowStatus;
  initialNowPlaying: string | null;
  /** Persist a patch. Should resolve true on success. */
  apply: (patch: LivePatch) => Promise<boolean>;
}) {
  const [status, setStatusState] = useState<ShowStatus>(initialStatus);
  const [nowPlaying, setNowPlaying] = useState<string | null>(initialNowPlaying);
  const [pending, start] = useTransition();
  // Out-of-order tap confirm. Used to be a window.confirm() popping
  // a system dialog; the bottom-sheet feels native to the rest of
  // the app and lets the admin re-read the country in context.
  const [confirmJump, setConfirmJump] = useState<
    { code: string; name: string } | null
  >(null);

  const run = (patch: LivePatch) => {
    start(async () => {
      const ok = await apply(patch);
      if (!ok) toast.error("Couldn't save.");
    });
  };

  const setStatus = (next: ShowStatus) => {
    setStatusState(next);
    // Only "not started" wipes who's on stage. A break should resume
    // exactly where it left off — going to break then back to "in
    // progress" must NOT reset the running order. (The now-playing hero
    // hides on any non-"in_progress" status anyway.)
    if (next === "not_started" && nowPlaying) {
      setNowPlaying(null);
      run({ showStatus: next, nowPlayingCode: null });
    } else {
      run({ showStatus: next });
    }
  };

  const setNowPlayingDirect = (code: string) => {
    setNowPlaying(code);
    run({ nowPlayingCode: code }); // the server derives the running-order position from the country's startlist order
  };

  // "Next" = the act right after whoever's on stage (or the first act if
  // nobody is yet).
  const curOrder = countries.find((c) => c.code === nowPlaying)?.order ?? 0;
  const nextCountry = countries.find((c) => c.order === curOrder + 1) ?? null;

  // Tapping a country other than "the next one" is almost always a fat
  // finger — confirm via a bottom-sheet before jumping the running
  // order around. (Used to be a window.confirm; the native dialog
  // felt off-brand and didn't let the admin re-read the act.)
  const pickFromList = (c: { code: string; name: string }) => {
    if (c.code === nowPlaying) return;
    if (nextCountry && c.code !== nextCountry.code) {
      setConfirmJump(c);
      return;
    }
    setNowPlayingDirect(c.code);
  };

  // Bigger "Next up" CTA below the four status pills. Was a thin row
  // tacked on at the bottom of the list; pulled up here so it's the
  // FIRST thing the eye lands on after picking a status, and sized
  // (h-14, font-base) so a finger lands on it confidently.
  const nextUpButton = status === "in_progress" && nextCountry && (
    <button
      type="button"
      disabled={pending}
      onClick={() => setNowPlayingDirect(nextCountry.code)}
      className="flex items-center gap-3 h-14 rounded-2xl bg-white text-dark-blue font-display text-base px-4
                 shadow-[0_8px_24px_-12px_rgba(255,255,255,0.4)]
                 disabled:opacity-60 active:scale-[0.99] transition"
    >
      <HeartFlag code={nextCountry.code} size="md" />
      <span className="flex flex-col items-start leading-tight min-w-0">
        <span className="text-[10px] uppercase tracking-[0.24em] text-dark-blue/60">
          Next up
        </span>
        <span className="truncate">{nextCountry.name}</span>
      </span>
      {nextCountry.order != null && (
        <span className="ml-auto text-xs tabular-nums text-dark-blue/55">
          #{nextCountry.order}
        </span>
      )}
    </button>
  );

  return (
    <section className="flex flex-col gap-3">
      <div className="grid grid-cols-4 gap-1.5">
        {STATUS_DEFS.map(({ id, label, Icon }) => {
          const active = status === id;
          return (
            <button
              key={id}
              type="button"
              disabled={pending}
              onClick={() => setStatus(id)}
              className={`flex flex-col items-center justify-center gap-1.5 h-[4.25rem] rounded-xl px-1
                          font-display text-[10.5px] leading-tight text-center transition
                          ${
                            active
                              ? "bg-flamingo text-white shadow-[0_4px_14px_-4px_oklch(70%_0.27_336_/_0.55)]"
                              : "bg-white/[0.04] ring-1 ring-white/10 text-white/70 hover:bg-white/[0.08]"
                          }`}
            >
              <Icon className="h-6 w-6" />
              {label}
            </button>
          );
        })}
      </div>

      {nextUpButton}

      {status === "in_progress" && (
        <div className="flex flex-col gap-1.5 max-h-[55vh] overflow-y-auto -mx-1 px-1">
          <p className="text-[10px] uppercase tracking-widest text-white/45 font-display px-1 pt-1 pb-1">
            Tap to put on stage
          </p>
          {countries.map((c) => {
            const isActive = nowPlaying === c.code;
            return (
              <button
                key={c.code}
                type="button"
                disabled={pending}
                onClick={() => pickFromList(c)}
                className={`flex items-center gap-3 rounded-xl px-2.5 py-2 text-left transition
                            ${
                              isActive
                                ? "bg-flamingo/15 ring-1 ring-flamingo/45"
                                : "bg-white/[0.03] ring-1 ring-white/8 hover:bg-white/[0.06]"
                            }`}
              >
                <span className="w-6 text-[11px] text-white/40 tabular-nums font-display">
                  {c.order}
                </span>
                <HeartFlag code={c.code} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="font-display text-sm truncate">{c.name}</p>
                  {c.artist && (
                    <p className="text-[11px] text-white/55 truncate">
                      {c.artist}
                      {c.song && (
                        <>
                          {" · "}
                          <span className="italic">{c.song}</span>
                        </>
                      )}
                    </p>
                  )}
                </div>
                {isActive && (
                  <span className="text-[10px] uppercase tracking-widest text-flamingo font-display">
                    Live
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <BottomSheet
        open={!!confirmJump}
        onClose={() => setConfirmJump(null)}
        title="Skip ahead?"
        sub={
          confirmJump
            ? `${confirmJump.name} isn't the next act in the running order.`
            : ""
        }
        footer={
          <>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirmJump(null)}
              className="text-white/70"
            >
              Cancel
            </Button>
            <div className="flex-1" />
            <Button
              type="button"
              onClick={() => {
                if (confirmJump) {
                  setNowPlayingDirect(confirmJump.code);
                }
                setConfirmJump(null);
              }}
              className="bg-flamingo text-white hover:bg-flamingo/90 rounded-2xl"
            >
              {confirmJump
                ? `Put ${confirmJump.name} on stage`
                : "Put on stage"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-white/65 leading-relaxed">
          You're about to jump the running order. The Next-up button at the
          top of this panel always picks the actual next act, in case this
          tap was a fat finger.
        </p>
      </BottomSheet>
    </section>
  );
}
