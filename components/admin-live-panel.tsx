"use client";

import { toast } from "sonner";
import {
  RoomLiveControls,
  type ShowStatus,
  type LivePatch,
} from "@/components/room-live-controls";

// Thin wrapper that points RoomLiveControls at the GLOBAL admin
// endpoint (POST /api/admin/live → fans out to every room).
export function AdminLivePanel({
  initialStatus,
  initialNowPlaying,
  initialRunningOrderPos,
}: {
  initialStatus: ShowStatus;
  initialNowPlaying: string | null;
  initialRunningOrderPos: number | null;
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
    <RoomLiveControls
      initialStatus={initialStatus}
      initialNowPlaying={initialNowPlaying}
      initialRunningOrderPos={initialRunningOrderPos}
      apply={apply}
      scopeLabel="all rooms"
    />
  );
}
