"use client";

import { useState, useTransition } from "react";
import { Pause, Sun, Flag as FlagIcon } from "lucide-react";
import { toast } from "sonner";
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

const STATUS_DEFS: { id: ShowStatus; label: string; Icon: typeof Pause }[] = [
  { id: "not_started", label: "Not started", Icon: Pause },
  { id: "in_progress", label: "In progress", Icon: Sun },
  { id: "break", label: "Break", Icon: Pause },
  { id: "ended", label: "Ended", Icon: FlagIcon },
];

export function RoomLiveControls({
  initialStatus,
  initialNowPlaying,
  apply,
  scopeLabel,
}: {
  initialStatus: ShowStatus;
  initialNowPlaying: string | null;
  /** Persist a patch. Should resolve true on success. */
  apply: (patch: LivePatch) => Promise<boolean>;
  /** Optional caption (e.g. "all active rooms"). */
  scopeLabel?: string;
}) {
  const [status, setStatusState] = useState<ShowStatus>(initialStatus);
  const [nowPlaying, setNowPlaying] = useState<string | null>(initialNowPlaying);
  const [pending, start] = useTransition();

  const run = (patch: LivePatch) => {
    start(async () => {
      const ok = await apply(patch);
      if (!ok) toast.error("Couldn't save.");
    });
  };

  const setStatus = (next: ShowStatus) => {
    setStatusState(next);
    // Anything other than "in progress" wipes who's on stage — a
    // break or "not started" shouldn't keep showing the last act.
    if (next !== "in_progress" && nowPlaying) {
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

  return (
    <section className="flex flex-col gap-3">
      {scopeLabel && (
        <p className="text-[10px] uppercase tracking-[0.24em] text-white/45 font-display">
          Applies to {scopeLabel}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        {STATUS_DEFS.map(({ id, label, Icon }) => {
          const active = status === id;
          return (
            <button
              key={id}
              type="button"
              disabled={pending}
              onClick={() => setStatus(id)}
              className={`flex items-center justify-center gap-1.5 h-10 rounded-xl
                          font-display text-sm transition
                          ${
                            active
                              ? "bg-flamingo text-white shadow-[0_4px_14px_-4px_oklch(70%_0.27_336_/_0.55)]"
                              : "bg-white/[0.04] ring-1 ring-white/10 text-white/70 hover:bg-white/[0.08]"
                          }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          );
        })}
      </div>

      {status === "in_progress" && nextCountry && (
        <button
          type="button"
          disabled={pending}
          onClick={() => setNowPlayingDirect(nextCountry.code)}
          className="flex items-center gap-2.5 h-11 rounded-xl bg-white text-dark-blue font-display text-sm px-3.5
                     disabled:opacity-60 active:scale-[0.99] transition"
        >
          <HeartFlag code={nextCountry.code} size="sm" />
          <span className="truncate">Next up → {nextCountry.name}</span>
          {nextCountry.order != null && (
            <span className="ml-auto text-[11px] tabular-nums text-dark-blue/50">#{nextCountry.order}</span>
          )}
        </button>
      )}

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
                onClick={() => setNowPlayingDirect(c.code)}
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
    </section>
  );
}
