"use client";

import { Trophy } from "lucide-react";
import { AdminRoomBooleanToggle } from "@/components/admin-room-boolean-toggle";

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
  return (
    <AdminRoomBooleanToggle
      code={code}
      field="tallyEnabled"
      initialEnabled={initialEnabled}
      icon={<Trophy className="h-5 w-5" />}
      label="Reveal results"
      subOn="The room sees the breakdown + leaderboard on the Results tab."
      subOff="Leaderboard stays hidden until you flip this on."
      toastOn="Results revealed"
      toastOff="Results hidden"
    />
  );
}
