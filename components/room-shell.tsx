"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { RoomProvider, useEventListener } from "@/lib/liveblocks";
import { Standings } from "@/components/standings";
import { FloatingReactionsLayer } from "@/components/floating-reactions";
import { PresenceBar } from "@/components/presence-bar";
import { HoneycombPresence } from "@/components/honeycomb-presence";
import { NameGate } from "@/components/name-gate";

const LAST_ROOM_KEY = "uzk_last_room";

// Live-room context: holds the props that can change at runtime
// (votingEnabled, tallyEnabled, name) so any descendant can subscribe
// without prop-drilling. Refreshed on every "room:updated" Liveblocks
// broadcast plus on initial mount.
type RoomLive = {
  code: string;
  name: string;
  votingEnabled: boolean;
};

const RoomLiveContext = createContext<RoomLive | null>(null);

export function useRoomLive(): RoomLive {
  const ctx = useContext(RoomLiveContext);
  if (!ctx) throw new Error("useRoomLive must be used inside <RoomShell>");
  return ctx;
}

export function RoomShell({
  code,
  name,
  votingEnabled,
}: {
  code: string;
  name: string;
  votingEnabled: boolean;
}) {
  useEffect(() => {
    localStorage.setItem(LAST_ROOM_KEY, code);
  }, [code]);

  return (
    <RoomProvider
      id={`room:${code}`}
      initialPresence={{ name: null, avatar: null, emoji: null, hoveredCountry: null }}
    >
      <NameGate>
        <RoomLiveProvider initial={{ code, name, votingEnabled }}>
          <div className="min-h-screen flex flex-col pb-32">
            <PresenceBar />
            <Standings />
            <FloatingReactionsLayer code={code} />
            {/* Honeycomb of online users in the lower right corner.
                Replaces the avatar strip we used to render in the header. */}
            <HoneycombPresence />
          </div>
        </RoomLiveProvider>
      </NameGate>
    </RoomProvider>
  );
}

// Refetches /api/rooms/[code] whenever a "room:updated" broadcast arrives
// and pushes the latest props down through context.
function RoomLiveProvider({
  initial,
  children,
}: {
  initial: RoomLive;
  children: React.ReactNode;
}) {
  const [state, setState] = useState<RoomLive>(initial);

  const refetch = useCallback(async () => {
    try {
      const res = await fetch(`/api/rooms/${initial.code}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        code: string;
        name: string;
        votingEnabled: boolean;
      };
      setState({
        code: data.code,
        name: data.name,
        votingEnabled: data.votingEnabled,
      });
    } catch {
      /* network blips don't kill us */
    }
  }, [initial.code]);

  useEventListener(({ event }) => {
    if ((event as { type?: string }).type === "room:updated") refetch();
  });

  return (
    <RoomLiveContext.Provider value={state}>{children}</RoomLiveContext.Provider>
  );
}
