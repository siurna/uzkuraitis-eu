"use client";

import { useEffect } from "react";
import { RoomProvider } from "@/lib/liveblocks";
import { Standings } from "@/components/standings";
import { FloatingReactionsLayer } from "@/components/floating-reactions";
import { PresenceBar } from "@/components/presence-bar";

const LAST_ROOM_KEY = "uzk_last_room";

export function RoomShell({
  code,
  name,
  votingEnabled,
}: {
  code: string;
  name: string;
  votingEnabled: boolean;
}) {
  // Persist the current room so the gate can auto-restore it after a phone
  // sleep, tab restore, or PWA reopen. Cleared by RoomGate when ?leave=1.
  useEffect(() => {
    localStorage.setItem(LAST_ROOM_KEY, code);
  }, [code]);

  return (
    <RoomProvider
      id={`room:${code}`}
      initialPresence={{ name: null, emoji: null, hoveredCountry: null }}
    >
      <div className="min-h-screen flex flex-col pb-32">
        <PresenceBar code={code} name={name} />
        <Standings code={code} votingEnabled={votingEnabled} />
        <FloatingReactionsLayer code={code} />
      </div>
    </RoomProvider>
  );
}
