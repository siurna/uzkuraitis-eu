"use client";

import { useState } from "react";
import { Radio } from "lucide-react";
import { toast } from "sonner";
import {
  RoomLiveControls,
  type ShowStatus,
  type LivePatch,
} from "@/components/room-live-controls";
import { AdminTriviaScheduler } from "@/components/admin-trivia-scheduler";

// Thin wrapper that points RoomLiveControls at the GLOBAL admin
// endpoint (POST /api/admin/live → fans out to every room). Matches the
// header chrome of the sister Broadcasts panel.
//
// Also owns the trivia scheduler: when nowPlayingCode changes, a 30s–
// 2:30 timer arms, fires a POST to /api/admin/live/trivia, fans the
// trivia card out to every room with triviaEnabled=true. The admin
// tab must stay open for the timer to live; a beforeunload prompt
// fires while it's pending.
export function AdminLivePanel({
  initialStatus,
  initialNowPlaying,
}: {
  initialStatus: ShowStatus;
  initialNowPlaying: string | null;
}) {
  const [nowPlaying, setNowPlaying] = useState<string | null>(initialNowPlaying);
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
      // Track nowPlaying locally so the trivia scheduler arms on a
      // fresh country (and disarms on null / break / ended).
      if (patch.nowPlayingCode !== undefined) {
        setNowPlaying(patch.nowPlayingCode);
      }
      if (
        patch.showStatus &&
        (patch.showStatus === "not_started" ||
          patch.showStatus === "break" ||
          patch.showStatus === "ended") &&
        patch.nowPlayingCode === undefined
      ) {
        // /admin/live auto-clears nowPlaying on these transitions, so
        // match locally too.
        setNowPlaying(null);
      }
    }
    return res.ok;
  };

  return (
    <section className="flex flex-col gap-4">
      <header className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center uzk-icon-squircle bg-flamingo/15 ring-1 ring-flamingo/30 text-flamingo">
          <Radio className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-display text-xl leading-tight">Show controls</h2>
          <p className="text-sm text-white/45 leading-snug mt-0.5 text-balance">
            Flip the show state and put a country on stage.
          </p>
        </div>
      </header>
      <RoomLiveControls
        initialStatus={initialStatus}
        initialNowPlaying={initialNowPlaying}
        apply={apply}
      />
      <AdminTriviaScheduler nowPlayingCode={nowPlaying} />
    </section>
  );
}
