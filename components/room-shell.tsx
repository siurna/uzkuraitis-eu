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
import { VotingAnnouncement } from "@/components/voting-announcement";

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
              <VotingAnnouncement />
              <RoomBody>{children}</RoomBody>
            </CountryDeepDiveProvider>
          </ParticleLayer>
        </RoomLiveProvider>
      </NameGate>
    </RoomProvider>
  );
}

// Body. The reaction emoji bar appears only on Home (the other tabs
// own the bottom for their own inputs). The unread-chat counter lives
// here so the tab bar can badge it: every chat:new bumps it unless
// the user is on the chat tab, and the chat panel resets it via the
// uzk:chat-seen event.
function RoomBody({ children }: { children: React.ReactNode }) {
  const { code } = useRoomLive();
  const pathname = usePathname();
  const isHome = pathname === `/r/${code}`;
  const isChat = pathname.startsWith(`/r/${code}/chat`);
  const [unread, setUnread] = useState(0);

  useEventListener(({ event }) => {
    if ((event as { type?: string }).type !== "chat:new") return;
    if (isChat) return; // already looking at it
    setUnread((n) => Math.min(99, n + 1));
  });

  useEffect(() => {
    if (isChat) setUnread(0);
  }, [isChat]);

  useEffect(() => {
    const onSeen = () => setUnread(0);
    window.addEventListener("uzk:chat-seen", onSeen);
    return () => window.removeEventListener("uzk:chat-seen", onSeen);
  }, []);

  return (
    <div className="min-h-screen flex flex-col pb-24">
      <PresenceBar />
      {children}
      {isHome && (
        <FloatingReactionsLayer code={code} hideBarOnMobile={false} />
      )}
      <RoomTabBar code={code} chatUnread={unread} />
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
    // Hearts rise from below the fold to a random height, in three
    // size/speed bands so the swarm reads as a flurry, not a uniform
    // pop. Staggered by spawning in micro-batches a few ms apart.
    const COUNT = 26;
    const fire = (n: number) =>
      particles.spawnMany(
        Array.from({ length: n }, () => {
          // Bias toward small + fast; a few big + slow drifters.
          const tier = Math.random();
          const size =
            tier > 0.85 ? 56 + Math.random() * 30 // big drifters
              : tier > 0.55 ? 36 + Math.random() * 18 // mid
                : 18 + Math.random() * 16; // small + fast
          const duration =
            tier > 0.85 ? 2600 + Math.random() * 900
              : tier > 0.55 ? 1900 + Math.random() * 700
                : 1300 + Math.random() * 500;
          const fromX = Math.random() * w;
          return {
            asset: { type: "country" as const, code: next },
            from: { x: fromX, y: h + 60 + Math.random() * 80 },
            to: {
              // Slight horizontal sway on the way up.
              x: fromX + (Math.random() - 0.5) * 160,
              y: Math.random() * h * 0.65,
            },
            size,
            durationMs: duration,
            rotate: 14 + Math.random() * 18,
          };
        }),
      );
    fire(10);
    setTimeout(() => fire(8), 120);
    setTimeout(() => fire(COUNT - 18), 280);
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
