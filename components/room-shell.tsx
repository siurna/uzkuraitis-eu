"use client";

import { RoomProvider } from "@/lib/liveblocks";
import { Standings } from "@/components/standings";
import { FloatingReactionsLayer } from "@/components/floating-reactions";
import { PresenceBar } from "@/components/presence-bar";

export function RoomShell({
  code,
  name,
  votingEnabled,
}: {
  code: string;
  name: string;
  votingEnabled: boolean;
}) {
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
