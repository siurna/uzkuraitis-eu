"use client";

import { Vote } from "lucide-react";
import { AdminRoomBooleanToggle } from "@/components/admin-room-boolean-toggle";

// Tile-style "voting open" switch. Used on /admin/live and the
// per-room detail page. The compact pill version (`AdminRoomToggle`)
// is still used in the admin rooms list where the row needs to stay
// one-line.
export function AdminRoomVotingToggleCard({
  code,
  initialEnabled,
}: {
  code: string;
  initialEnabled: boolean;
}) {
  return (
    <AdminRoomBooleanToggle
      code={code}
      field="votingEnabled"
      initialEnabled={initialEnabled}
      icon={<Vote className="h-5 w-5" />}
      label="Voting open"
      subOn="The Vote tab is live. Viewers can cast and update their ballot."
      subOff="Vote tab is closed. Lines stay shut until you flip this on."
      toastOn="Voting opened"
      toastOff="Voting closed"
    />
  );
}
