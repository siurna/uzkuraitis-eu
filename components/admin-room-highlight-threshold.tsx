"use client";

import { useState, useTransition } from "react";
import { Flame } from "lucide-react";
import { toast } from "sonner";

// Highlight threshold: how many reactions a chat message needs
// before it counts as a "highlight" — bonus-point fuel for the
// author, badge in the leaderboard. The global default is 5;
// hosts can lower it for small parties (a fan-of-three room would
// never hit 5) or raise it for big rooms.
export function AdminRoomHighlightThreshold({
  code,
  initialThreshold,
}: {
  code: string;
  initialThreshold: number;
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

  return (
    <div className="w-full flex items-center gap-3 rounded-2xl px-4 py-3 bg-white/[0.04] ring-1 ring-white/8 text-left">
      <span className="shrink-0 grid place-items-center h-10 w-10 rounded-xl bg-white/[0.06] ring-1 ring-white/12 text-white/65">
        <Flame className="h-5 w-5" fill="currentColor" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-display text-base">Highlight threshold</p>
        <p className="text-xs text-white/50 leading-snug">
          Reactions a chat message needs to count as a highlight. Default 5.
        </p>
      </div>
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
