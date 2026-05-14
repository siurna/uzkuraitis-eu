"use client";

import { useState, useTransition } from "react";
import { Flame } from "lucide-react";
import { toast } from "sonner";

// Highlight threshold: how many reactions a chat message needs
// before it counts as a "highlight" — bonus-point fuel for the
// author, badge in the leaderboard. The global default is 5;
// hosts can lower it for small parties (a fan-of-three room would
// never hit 5) or raise it for big rooms.
//
// `size` mirrors AdminRoomTriviaThreshold: "compact" for the Live
// cockpit, "comfortable" for the per-room settings page.
export function AdminRoomHighlightThreshold({
  code,
  initialThreshold,
  size = "compact",
}: {
  code: string;
  initialThreshold: number;
  size?: "compact" | "comfortable";
}) {
  const [value, setValue] = useState<string>(String(initialThreshold));
  const [pending, start] = useTransition();
  const [dirty, setDirty] = useState(false);

  const save = () => {
    const n = Math.max(1, Math.min(50, Math.round(Number(value)) || 5));
    start(async () => {
      const res = await fetch(`/api/admin/rooms/${code}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ highlightThreshold: n }),
      });
      if (!res.ok) {
        toast.error("Couldn't update the room.");
        return;
      }
      setDirty(false);
      setValue(String(n));
      toast.success(`Highlight threshold set to ${n}.`);
    });
  };

  const accented = Number(value) !== 5;
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
                    ${accented ? "bg-flamingo/20 ring-1 ring-flamingo/40 text-flamingo" : "bg-white/[0.06] ring-1 ring-white/12 text-white/55"}`}
      >
        <Flame className={isComfy ? "h-5 w-5" : "h-4 w-4"} fill="currentColor" />
      </span>
      <span className="flex-1 min-w-0">
        <span className={`block font-display text-white ${isComfy ? "text-base" : "text-sm"}`}>
          Highlight threshold
        </span>
        {isComfy && (
          <span className="block text-xs text-white/50 leading-snug">
            {Number(value) === 5
              ? "Five reactions to highlight a message (default)."
              : `${value} reactions to highlight a message.`}
          </span>
        )}
      </span>
      <input
        type="number"
        min={1}
        max={50}
        inputMode="numeric"
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
