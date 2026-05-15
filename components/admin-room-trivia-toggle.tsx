"use client";

import { Lightbulb } from "lucide-react";
import { AdminRoomBooleanToggle } from "@/components/admin-room-boolean-toggle";

// Per-room "subscribe to global trivia" switch. The global admin
// scheduler in /admin/live arms a setTimeout when a country goes on
// stage and fires /api/admin/live/trivia when the timer pops; that
// endpoint only drops the trivia card into rooms whose
// triviaEnabled is true. Default on; flip off for a trivia-free
// watch-along.
export function AdminRoomTriviaToggle({
  code,
  initialEnabled,
}: {
  code: string;
  initialEnabled: boolean;
}) {
  return (
    <AdminRoomBooleanToggle
      code={code}
      field="triviaEnabled"
      initialEnabled={initialEnabled}
      icon={<Lightbulb className="h-5 w-5" />}
      label="Trivia in chat"
      subOn="Mid-song trivia card drops in when the global scheduler fires."
      subOff="No trivia in this room, even if the rest of the show gets one."
      toastOn="Trivia on"
      toastOff="Trivia off"
    />
  );
}
