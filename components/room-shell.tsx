"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import { RoomProvider, useEventListener } from "@/lib/liveblocks";
import { FloatingReactionsLayer } from "@/components/floating-reactions";
import { PresenceBar } from "@/components/presence-bar";
import { NameGate } from "@/components/name-gate";
import { RoomTabBar } from "@/components/room-tab-bar";
import {
  ParticleLayer,
  useParticles,
} from "@/components/particle-layer";
import { CountryDeepDiveProvider } from "@/components/country-deep-dive";

const LAST_ROOM_KEY = "uzk_last_room";

// Live-room context. Everything mutable at runtime (votingEnabled,
// tallyEnabled, name, home country, now_playing) lives here so any
// descendant can subscribe without prop-drilling. Refreshed on every
// "room:updated" / "now-playing:change" broadcast.
type ShowStatus = "not_started" | "in_progress" | "break" | "ended";

type RoomLive = {
  code: string;
  name: string;
  votingEnabled: boolean;
  homeCountryCode: string;
  nowPlayingCode: string | null;
  showStatus: ShowStatus;
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
        <RoomLiveProvider
          initial={{
            code,
            name,
            votingEnabled,
            homeCountryCode,
            nowPlayingCode: null,
            showStatus: "not_started",
          }}
        >
          <ParticleLayer>
            <CountryDeepDiveProvider>
              <NowPlayingSwarm />
              <RoomBody>{children}</RoomBody>
            </CountryDeepDiveProvider>
          </ParticleLayer>
        </RoomLiveProvider>
      </NameGate>
    </RoomProvider>
  );
}

// Body. The reaction emoji bar should only appear on the Home tab —
// the other tabs (chat/bingo/vote) own the bottom area for their own
// inputs and the bar would fight the tab bar for space.
function RoomBody({ children }: { children: React.ReactNode }) {
  const { code } = useRoomLive();
  const pathname = usePathname();
  const isHome = pathname === `/r/${code}`;
  return (
    <div className="min-h-screen flex flex-col pb-24">
      <PresenceBar />
      {children}
      {isHome && (
        <FloatingReactionsLayer code={code} hideBarOnMobile={false} />
      )}
      <RoomTabBar code={code} />
    </div>
  );
}

// Listen-only side-effect component: when the admin flips the active
// country, we update local state (via the Provider's refetch) AND
// spawn a swarm of that country's heart-flag particles across the
// viewport. Visible-component logic moved into PresenceBar — this
// component renders nothing.
function NowPlayingSwarm() {
  const particles = useParticles();
  useEventListener(({ event }) => {
    if ((event as { type?: string }).type !== "now-playing:change") return;
    const next = (event as { countryCode: string | null }).countryCode;
    if (!next || typeof window === "undefined") return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    particles.spawnMany(
      Array.from({ length: 18 }, () => ({
        asset: { type: "country" as const, code: next },
        from: { x: w / 2, y: h * 0.45 },
        to: {
          x: Math.random() * w,
          y: Math.random() * h * 0.85,
        },
        size: 44 + Math.random() * 28,
        durationMs: 1400 + Math.random() * 400,
        rotate: 18,
      })),
    );
  });
  return null;
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
        nowPlayingCode: string | null;
        showStatus?: ShowStatus;
      };
      setState({
        code: data.code,
        name: data.name,
        votingEnabled: data.votingEnabled,
        homeCountryCode: data.homeCountryCode ?? initial.homeCountryCode,
        nowPlayingCode: data.nowPlayingCode ?? null,
        showStatus: data.showStatus ?? "not_started",
      });
    } catch {
      /* network blips don't kill us */
    }
  }, [initial.code, initial.homeCountryCode]);

  // Pull the initial nowPlayingCode after mount so the header reflects
  // server state without waiting for a broadcast.
  useEffect(() => {
    refetch();
  }, [refetch]);

  useEventListener(({ event }) => {
    const ev = event as { type?: string; countryCode?: string | null };
    if (ev.type === "room:updated") {
      refetch();
    } else if (ev.type === "now-playing:change") {
      setState((prev) => ({
        ...prev,
        nowPlayingCode: ev.countryCode ?? null,
      }));
    }
  });

  return (
    <RoomLiveContext.Provider value={state}>{children}</RoomLiveContext.Provider>
  );
}
