"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { RoomProvider, useEventListener } from "@/lib/liveblocks";
import { FloatingReactionsLayer } from "@/components/floating-reactions";
import { PresenceBar } from "@/components/presence-bar";
import { NameGate } from "@/components/name-gate";
import { RoomTabBar } from "@/components/room-tab-bar";
import { ParticleLayer } from "@/components/particle-layer";
import { NowPlaying } from "@/components/now-playing";

const LAST_ROOM_KEY = "uzk_last_room";

// Live-room context. Everything mutable at runtime (votingEnabled,
// tallyEnabled, name, home country, now_playing) lives here so any
// descendant can subscribe without prop-drilling. Refreshed on every
// "room:updated" Liveblocks broadcast plus on initial mount.
type RoomLive = {
  code: string;
  name: string;
  votingEnabled: boolean;
  homeCountryCode: string;
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
  homeCountryCode,
  children,
}: {
  code: string;
  name: string;
  votingEnabled: boolean;
  homeCountryCode: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    localStorage.setItem(LAST_ROOM_KEY, code);
    // Register the service worker for offline + push. Fire-and-forget;
    // the SW never gets in the way of the page rendering.
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, [code]);

  return (
    <RoomProvider
      id={`room:${code}`}
      initialPresence={{ name: null, avatar: null, emoji: null, hoveredCountry: null }}
    >
      <NameGate>
        <RoomLiveProvider initial={{ code, name, votingEnabled, homeCountryCode }}>
          <ParticleLayer>
            <div className="min-h-screen flex flex-col pb-24">
              <PresenceBar />
              <NowPlaying />
              {children}
              <FloatingReactionsLayer code={code} hideBarOnMobile={false} />
              <RoomTabBar code={code} />
            </div>
          </ParticleLayer>
        </RoomLiveProvider>
      </NameGate>
    </RoomProvider>
  );
}

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
        homeCountryCode: string;
      };
      setState({
        code: data.code,
        name: data.name,
        votingEnabled: data.votingEnabled,
        homeCountryCode: data.homeCountryCode ?? initial.homeCountryCode,
      });
    } catch {
      /* network blips don't kill us */
    }
  }, [initial.code, initial.homeCountryCode]);

  useEventListener(({ event }) => {
    if ((event as { type?: string }).type === "room:updated") refetch();
  });

  return (
    <RoomLiveContext.Provider value={state}>{children}</RoomLiveContext.Provider>
  );
}
