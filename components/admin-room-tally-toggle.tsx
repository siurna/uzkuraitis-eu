"use client";

import { useState, useTransition } from "react";
import { Trophy } from "lucide-react";
import { toast } from "sonner";

// Per-room "reveal the scoreboard" switch. Off until the host is ready
// to drop results on the room; on flips the Vote tab into Results and
// renders the leaderboard. The host's magic-link page can also fire
// push notifications + a chat system line at the same time; here we
// just flip the column and broadcast a refetch.
export function AdminRoomTallyToggle({
  code,
  initialEnabled,
}: {
  code: string;
  initialEnabled: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, start] = useTransition();

  const flip = () => {
    start(async () => {
      const next = !enabled;
      const res = await fetch(`/api/admin/rooms/${code}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tallyEnabled: next }),
      });
      if (!res.ok) {
        toast.error("Couldn't update the room.");
        return;
      }
      setEnabled(next);
      toast.success(next ? "Results revealed" : "Results hidden");
    });
  };

  return (
    <button
      type="button"
      onClick={flip}
      disabled={pending}
      aria-pressed={enabled}
      className="w-full flex items-center gap-3 rounded-2xl px-4 py-3
                 bg-white/[0.04] ring-1 ring-white/8 hover:bg-white/[0.07] transition text-left
                 disabled:opacity-60"
    >
      <span
        className={`shrink-0 grid place-items-center h-10 w-10 rounded-xl transition
                    ${enabled ? "bg-gold/20 ring-1 ring-gold/45 text-gold" : "bg-white/[0.06] ring-1 ring-white/12 text-white/55"}`}
      >
        <Trophy className="h-5 w-5" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block font-display text-base">Reveal results</span>
        <span className="block text-xs text-white/50 leading-snug">
          {enabled
            ? "The room sees the breakdown + leaderboard on the Results tab."
            : "Leaderboard stays hidden until you flip this on."}
        </span>
      </span>
      <span
        className={`relative h-6 w-11 rounded-full transition shrink-0 ${
          enabled ? "bg-gold/70" : "bg-white/10"
        }`}
        aria-hidden
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition transform ${
            enabled ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </span>
    </button>
  );
}
