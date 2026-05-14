"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, UserX } from "lucide-react";

// Admin "Remove" button — one tap suspends the participant from this
// room: wipes their voter row, chat messages, trivia answers and push
// subscriptions, and writes a 10-minute cooldown so their client
// bounces to the cooldown screen on its next write. Used inside each
// participant's <details> panel on /admin/rooms/[code].
//
// One-step confirm: tap once to arm, tap again within 4s to commit.
// Cheap protection against fat-fingering on a row.
export function AdminRemoveParticipant({
  code,
  sessionId,
  name,
}: {
  code: string;
  sessionId: string;
  name: string;
}) {
  const [armed, setArmed] = useState(false);
  const [pending, start] = useTransition();

  const arm = () => {
    setArmed(true);
    window.setTimeout(() => setArmed(false), 4000);
  };

  const commit = () => {
    setArmed(false);
    start(async () => {
      const res = await fetch(
        `/api/admin/rooms/${code}/voters/${sessionId}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        toast.error("Couldn't remove that participant.");
        return;
      }
      const data = (await res.json().catch(() => ({}))) as {
        removed?: number;
      };
      toast.success(
        `${name} removed${
          data.removed ? ` (${data.removed} messages wiped)` : ""
        }.`,
      );
    });
  };

  if (pending) {
    return (
      <button
        type="button"
        disabled
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-display
                   bg-error/15 ring-1 ring-error/30 text-error/80"
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Removing…
      </button>
    );
  }

  if (!armed) {
    return (
      <button
        type="button"
        onClick={arm}
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-display
                   bg-white/[0.04] ring-1 ring-white/12 text-white/65
                   hover:text-error hover:bg-error/10 hover:ring-error/30 transition"
      >
        <UserX className="h-3.5 w-3.5" />
        Remove
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={commit}
      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-display
                 bg-error/20 ring-1 ring-error/45 text-error animate-pulse"
    >
      <UserX className="h-3.5 w-3.5" />
      Tap to confirm
    </button>
  );
}
