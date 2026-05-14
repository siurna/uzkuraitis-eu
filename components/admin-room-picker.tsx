"use client";

import { useState } from "react";
import { Check, ChevronDown, Vote } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";

// Shared room picker — a chip-style trigger button on the right that
// opens a bottom-sheet drawer with the full room list. Replaces the
// raw <select> used to live on /admin/live + /admin/settings (seed).
// Caller owns the selected `value` and persistence (the live page +
// the seed panel each keep their own localStorage key so the choice
// survives reloads).
export function AdminRoomPicker({
  rooms,
  value,
  onChange,
  emptyLabel = "No rooms yet",
  className = "",
}: {
  rooms: { code: string; name: string }[];
  value: string;
  onChange: (code: string) => void;
  /** Shown inside the trigger when there are no rooms to pick from. */
  emptyLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = rooms.find((r) => r.code === value) ?? null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={rooms.length === 0}
        className={`inline-flex items-center gap-3 rounded-xl bg-white/[0.04] ring-1 ring-white/12
                    px-3 h-10 text-left transition hover:bg-white/[0.07] hover:ring-white/20
                    disabled:opacity-50 disabled:cursor-not-allowed
                    focus:outline-none focus:ring-2 focus:ring-flamingo/45
                    ${className}`}
      >
        {selected ? (
          // `flex-1` pushes the chevron to the far right of the
          // trigger so the affordance is always at the edge, not
          // hugging the end of the title.
          <span className="flex flex-1 min-w-0 flex-col leading-tight text-left">
            <span className="font-display text-sm text-white truncate">{selected.name}</span>
            <span className="text-[10px] uppercase tracking-[0.22em] text-white/45 tabular-nums leading-none">
              {selected.code}
            </span>
          </span>
        ) : (
          <span className="flex-1 text-sm text-white/55">{emptyLabel}</span>
        )}
        <ChevronDown className="h-4 w-4 text-white/55 shrink-0 ml-auto" />
      </button>

      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Pick a room"
        sub={`${rooms.length} room${rooms.length === 1 ? "" : "s"}`}
      >
        <ul className="flex flex-col gap-1.5">
          {rooms.map((r) => {
            const isActive = r.code === value;
            return (
              <li key={r.code}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(r.code);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition
                              ${isActive
                                ? "bg-flamingo/15 ring-1 ring-flamingo/35"
                                : "glass-surface hover:bg-white/[0.08]"}`}
                >
                  <span
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl
                                ${isActive ? "bg-flamingo/25 ring-1 ring-flamingo/45 text-flamingo" : "bg-white/[0.06] ring-1 ring-white/12 text-white/55"}`}
                  >
                    <Vote className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-sm text-white truncate">{r.name}</span>
                    <span className="block text-[10px] uppercase tracking-[0.24em] text-white/40 tabular-nums">
                      {r.code}
                    </span>
                  </span>
                  {isActive && <Check className="h-4 w-4 text-flamingo shrink-0" />}
                </button>
              </li>
            );
          })}
        </ul>
      </BottomSheet>
    </>
  );
}
