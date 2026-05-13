"use client";

import { useState, useTransition } from "react";
import { Vote } from "lucide-react";
import { toast } from "sonner";

// Tile-style "voting open" switch — same shape as
// AdminRoomTallyToggle (icon tile + title + sub + toggle) so the two
// can sit side-by-side on /admin/live without one looking like an
// afterthought of the other. The compact pill version
// (`AdminRoomToggle`) is still used in the admin rooms list + the
// per-room detail header where the row needs to stay one-line.
export function AdminRoomVotingToggleCard({
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
        body: JSON.stringify({ votingEnabled: next }),
      });
      if (!res.ok) {
        toast.error("Couldn't update the room.");
        return;
      }
      setEnabled(next);
      toast.success(next ? "Voting opened" : "Voting closed");
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
                    ${enabled ? "bg-success/20 ring-1 ring-success/45 text-success" : "bg-white/[0.06] ring-1 ring-white/12 text-white/55"}`}
      >
        <Vote className="h-5 w-5" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block font-display text-base">Voting open</span>
        <span className="block text-xs text-white/50 leading-snug">
          {enabled
            ? "The Vote tab is live. Viewers can cast and update their ballot."
            : "Vote tab is closed. Lines stay shut until you flip this on."}
        </span>
      </span>
      <span
        className={`relative h-6 w-11 rounded-full transition shrink-0 ${
          enabled ? "bg-success/70" : "bg-white/10"
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
