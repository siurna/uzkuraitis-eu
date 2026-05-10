"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useRoomLive } from "@/components/room-shell";

// Header bar with the room name + code + share button. Avatars used to
// live in here too; they've moved to <HoneycombPresence/> in the lower
// right of the screen so the header stays uncluttered no matter how
// many people join.
export function PresenceBar() {
  const { code, name } = useRoomLive();
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = `${window.location.origin}/?room=${code}`;
    const payload = {
      title: `${name}, Eurovision 2026`,
      text: `Join my Eurovision room, code ${code}`,
      url,
    };
    if (navigator.share) {
      try {
        await navigator.share(payload);
        return;
      } catch {
        /* user cancelled, fall through to clipboard */
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Link copied!");
    setTimeout(() => setCopied(false), 1500);
  };

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
          onClick={share}
          aria-label="Share room link"
          className="rounded-full"
        >
          <Share2 className="h-4 w-4" />
        </Button>
      </div>
      <span aria-live="polite" className="sr-only">
        {copied ? "Link copied" : ""}
      </span>
    </header>
  );
}
