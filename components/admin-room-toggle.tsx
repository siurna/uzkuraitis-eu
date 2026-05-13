"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

// Compact voting-open switch for the admin room header. A pill that
// reads its own state — green track + label when open, muted when shut.
export function AdminRoomToggle({
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
      className={`group flex items-center gap-2.5 rounded-full pl-3.5 pr-2 py-1.5 text-sm font-display
                  ring-1 transition disabled:opacity-60
                  ${
                    enabled
                      ? "bg-success/15 text-success ring-success/40 hover:bg-success/25"
                      : "bg-white/[0.04] text-white/55 ring-white/12 hover:bg-white/[0.08]"
                  }`}
    >
      <span className="leading-none">{enabled ? "Voting open" : "Voting closed"}</span>
      <span
        className={`relative h-5 w-9 rounded-full transition shrink-0 ${
          enabled ? "bg-success/70" : "bg-white/15"
        }`}
        aria-hidden
      >
        <span
          className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
            enabled ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </span>
    </button>
  );
}
