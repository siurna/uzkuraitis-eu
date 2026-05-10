"use client";

import { useState } from "react";
import { Settings as SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRoomLive } from "@/components/room-shell";
import { SettingsModal } from "@/components/settings-modal";

// Header bar: room name + code + settings cog. The cog used to be a
// share button; share is now one of the actions inside the settings
// sheet (alongside name / avatar / language editing) so the header
// stays minimal and uncrowded as the room fills up.
export function PresenceBar() {
  const { code, name } = useRoomLive();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/?room=${code}`
      : "";

  return (
    <header className="sticky top-0 z-30 backdrop-blur-md bg-dark-blue-900/70 border-b border-white/5">
      <div className="container mx-auto max-w-3xl px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <p className="font-display text-lg truncate">{name}</p>
            <code className="text-xs font-mono uppercase tracking-[0.3em] text-flamingo">
              {code}
            </code>
          </div>
        </div>

        <Button
          size="sm"
          variant="ghost"
          onClick={() => setSettingsOpen(true)}
          aria-label="Settings"
          className="rounded-full"
        >
          <SettingsIcon className="h-4 w-4" />
        </Button>
      </div>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        shareUrl={shareUrl}
      />
    </header>
  );
}
