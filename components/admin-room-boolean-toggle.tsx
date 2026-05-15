"use client";

import type { ReactNode } from "react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { TogglePill } from "@/components/ui/toggle-pill";

// Shared tile-style boolean toggle for room-level admin flags. The
// state + PATCH /api/admin/rooms/[code] + optimistic flip were
// duplicated across AdminRoomVotingToggleCard,
// AdminRoomTallyToggle, and AdminRoomCommentatorToggle. They differ
// only in their icon, label, sub-copy, and the field name on the
// room row; everything else (the surface, the switch shape, the
// toast cadence) is identical, so a single component now reads the
// per-instance text from props and lets callers stay one-liners.

type ToggleField =
  | "votingEnabled"
  | "tallyEnabled"
  | "commentatorEnabled"
  | "triviaEnabled";

export type AdminRoomBooleanToggleProps = {
  code: string;
  field: ToggleField;
  initialEnabled: boolean;
  icon: ReactNode;
  label: string;
  /** Copy under the title — different for the on / off state. */
  subOn: string;
  subOff: string;
  /** Toast lines fired after a successful flip. */
  toastOn?: string;
  toastOff?: string;
};

export function AdminRoomBooleanToggle({
  code,
  field,
  initialEnabled,
  icon,
  label,
  subOn,
  subOff,
  toastOn,
  toastOff,
}: AdminRoomBooleanToggleProps) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, start] = useTransition();

  const flip = () => {
    start(async () => {
      const next = !enabled;
      const res = await fetch(`/api/admin/rooms/${code}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ [field]: next }),
      });
      if (!res.ok) {
        toast.error("Couldn't update the room.");
        return;
      }
      setEnabled(next);
      const line = next ? toastOn : toastOff;
      if (line) toast.success(line);
    });
  };

  return (
    <button
      type="button"
      onClick={flip}
      disabled={pending}
      aria-pressed={enabled}
      className="w-full flex items-center gap-3 rounded-2xl px-4 py-3
                 glass-surface hover:bg-white/[0.07] transition text-left
                 disabled:opacity-60"
    >
      <span className="shrink-0 grid place-items-center h-10 w-10 uzk-icon-squircle bg-white/[0.06] ring-1 ring-white/12 text-white/65">
        {icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block font-display text-base">{label}</span>
        <span className="block text-xs text-white/50 leading-snug text-balance">
          {enabled ? subOn : subOff}
        </span>
      </span>
      <TogglePill on={enabled} />
    </button>
  );
}
