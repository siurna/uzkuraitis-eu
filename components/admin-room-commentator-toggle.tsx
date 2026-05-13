"use client";

import { useState, useTransition } from "react";
import { Megaphone } from "lucide-react";
import { toast } from "sonner";

// Per-room toggle for the auto-commentator: when on, the bot drops a
// line in chat each time a country takes the stage. Off mutes the bot
// in this room only (the global commentator settings stay intact).
export function AdminRoomCommentatorToggle({
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
        body: JSON.stringify({ commentatorEnabled: next }),
      });
      if (!res.ok) {
        toast.error("Couldn't update the room.");
        return;
      }
      setEnabled(next);
      toast.success(next ? "Auto-commentator on" : "Auto-commentator muted");
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
                    ${enabled ? "bg-flamingo/15 ring-1 ring-flamingo/35 text-flamingo" : "bg-white/[0.06] ring-1 ring-white/12 text-white/55"}`}
      >
        <Megaphone className="h-5 w-5" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block font-display text-base">Auto-commentator</span>
        <span className="block text-xs text-white/50 leading-snug">
          {enabled
            ? "The bot drops a line in chat when a country hits the stage."
            : "Muted in this room. Global commentary still runs elsewhere."}
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
