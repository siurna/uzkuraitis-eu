"use client";

import { useState, useTransition } from "react";
import { Lightbulb } from "lucide-react";
import { toast } from "sonner";

// Trivia threshold: a small input that caps how many players can
// answer a single trivia question in this room. 0 / empty = unlimited
// (the default). The server enforces the cap in
// /api/rooms/[code]/trivia — fresh-session answers past the threshold
// get a 409.
//
// `size`: "compact" (default) mirrors the DrawerSwitch row shape on
// the Live cockpit; "comfortable" matches AdminRoomBooleanToggle so
// the Behaviour section on the per-room settings page reads as one
// visual family with the tally / commentator toggles.
export function AdminRoomTriviaThreshold({
  code,
  initialMax,
  size = "compact",
}: {
  code: string;
  initialMax: number | null;
  size?: "compact" | "comfortable";
}) {
  const [value, setValue] = useState<string>(
    initialMax != null ? String(initialMax) : "",
  );
  const [pending, start] = useTransition();
  const [dirty, setDirty] = useState(false);

  const save = () => {
    const parsed = value.trim() === "" ? null : Math.max(0, Number(value));
    if (parsed != null && !Number.isFinite(parsed)) {
      toast.error("Enter a number or leave blank.");
      return;
    }
    start(async () => {
      const res = await fetch(`/api/admin/rooms/${code}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ triviaMaxAnswerers: parsed }),
      });
      if (!res.ok) {
        toast.error("Couldn't update the room.");
        return;
      }
      setDirty(false);
      toast.success(parsed ? `Trivia capped at ${parsed} answers.` : "Trivia: unlimited answers.");
    });
  };

  const active = value.trim() !== "" && Number(value) > 0;
  const isComfy = size === "comfortable";
  return (
    <div
      className={`w-full flex items-center gap-3 glass-surface text-left ${
        isComfy ? "rounded-2xl px-4 py-3" : "rounded-xl px-3 py-2.5"
      }`}
    >
      <span
        className={`shrink-0 grid place-items-center transition
                    ${isComfy ? "h-10 w-10 rounded-xl" : "h-8 w-8 rounded-lg"}
                    ${active ? "bg-yellow/20 ring-1 ring-yellow/40 text-yellow" : "bg-white/[0.06] ring-1 ring-white/12 text-white/55"}`}
      >
        <Lightbulb className={isComfy ? "h-5 w-5" : "h-4 w-4"} fill="currentColor" />
      </span>
      <span className="flex-1 min-w-0">
        <span className={`block font-display text-white ${isComfy ? "text-base" : "text-sm"}`}>
          Trivia answer cap
        </span>
        {isComfy && (
          <span className="block text-xs text-white/50 leading-snug text-balance">
            {active
              ? `Capped at ${value} answers per question.`
              : "No cap, anyone can lock an answer."}
          </span>
        )}
      </span>
      <input
        type="number"
        min={0}
        inputMode="numeric"
        placeholder="∞"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setDirty(true);
        }}
        className="h-9 w-16 rounded-lg bg-black/30 border border-white/15 px-2 text-center
                   font-display text-sm text-white tabular-nums
                   focus:border-flamingo focus:outline-none focus:ring-2 focus:ring-flamingo/40"
      />
      {dirty && (
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="shrink-0 h-9 px-3 rounded-lg bg-white text-dark-blue font-display text-xs
                     active:scale-[0.97] transition disabled:opacity-60"
        >
          Save
        </button>
      )}
    </div>
  );
}
