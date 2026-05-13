"use client";

import { Radio } from "lucide-react";
import { toast } from "sonner";
import {
  RoomLiveControls,
  type ShowStatus,
  type LivePatch,
} from "@/components/room-live-controls";

// Thin wrapper that points RoomLiveControls at the GLOBAL admin
// endpoint (POST /api/admin/live → fans out to every room). Matches the
// header chrome of the sister Broadcasts panel.
export function AdminLivePanel({
  initialStatus,
  initialNowPlaying,
}: {
  initialStatus: ShowStatus;
  initialNowPlaying: string | null;
}) {
  const apply = async (patch: LivePatch): Promise<boolean> => {
    const res = await fetch("/api/admin/live", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const data = (await res.json()) as { rooms?: number };
      toast.success(
        `Broadcast to ${data.rooms ?? "all"} room${data.rooms === 1 ? "" : "s"}.`,
      );
    }
    return res.ok;
  };

  return (
    <section className="flex flex-col gap-4">
      <header className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-flamingo/15 ring-1 ring-flamingo/30 text-flamingo">
          <Radio className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-display text-xl leading-tight">Show controls</h2>
          <p className="text-sm text-white/45 leading-snug mt-0.5">
            Flip the show state and put a country on stage.
          </p>
        </div>
      </header>
      <RoomLiveControls
        initialStatus={initialStatus}
        initialNowPlaying={initialNowPlaying}
        apply={apply}
      />
    </section>
  );
}
