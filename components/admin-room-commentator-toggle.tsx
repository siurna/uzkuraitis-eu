"use client";

import { Megaphone } from "lucide-react";
import { AdminRoomBooleanToggle } from "@/components/admin-room-boolean-toggle";

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
  return (
    <AdminRoomBooleanToggle
      code={code}
      field="commentatorEnabled"
      initialEnabled={initialEnabled}
      icon={<Megaphone className="h-5 w-5" />}
      label="Auto-commentator"
      subOn="The bot drops a line in chat when a country hits the stage."
      subOff="Muted in this room. Global commentary still runs elsewhere."
      toastOn="Auto-commentator on"
      toastOff="Auto-commentator muted"
    />
  );
}
