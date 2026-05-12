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
import { NowPlayingTakeover } from "@/components/now-playing-takeover";

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
  tallyEnabled: boolean;
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
      initialPresence={{ name: null, avatar: null, emoji: null, hoveredCountry: null, typing: false, seenAt: null }}
    >
      <NameGate>
        <RoomLiveProvider
          initial={{
            code,
            name,
            votingEnabled,
            tallyEnabled: false,
            homeCountryCode,
            nowPlayingCode: null,
            showStatus: "not_started",
          }}
        >
          <ParticleLayer>
            <CountryDeepDiveProvider>
              <NowPlayingSwarm />
              <NowPlayingTakeover />
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
  // Hide the bottom dock + reactions bar while the chat composer is
  // focused — on iOS the keyboard otherwise stacks them over the input.
  const [composing, setComposing] = useState(false);

  useEventListener(({ event }) => {
    const ev = event as { type?: string; quiet?: boolean };
    if (ev.type !== "chat:new") return;
    if (ev.quiet) return; // meta/system lines (now-playing, "X voted"…) don't badge
    if (isChat) return; // already looking at it
    setUnread((n) => Math.min(99, n + 1));
  });

  useEffect(() => {
    if (isChat) setUnread(0);
  }, [isChat]);

  useEffect(() => {
    const onSeen = () => setUnread(0);
    const onCompose = (e: Event) => setComposing(!!(e as CustomEvent).detail);
    window.addEventListener("uzk:chat-seen", onSeen);
    window.addEventListener("uzk:compose-focus", onCompose);
    return () => {
      window.removeEventListener("uzk:chat-seen", onSeen);
      window.removeEventListener("uzk:compose-focus", onCompose);
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col pb-24">
      <PresenceBar />
      {children}
      {(isHome || isChat) && !composing && (
        <FloatingReactionsLayer
          code={code}
          hideBarOnMobile={false}
          // On the chat tab, ride above the pinned composer.
          liftAboveComposer={isChat}
        />
      )}
      {!composing && <RoomTabBar code={code} chatUnread={unread} />}
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
    // A clean "release of balloons": hearts rise from just below the
    // fold and float straight up off the top with only a gentle sway.
    // Two calm size bands (small / medium) — the bigger ones drift a
    // touch slower for a light parallax. Spawn X is centre-weighted so
    // it reads as a burst from the stage, not random screen noise.
    const rng = (a: number, b: number) => a + Math.random() * (b - a);
    const fire = (n: number) =>
      particles.spawnMany(
        Array.from({ length: n }, () => {
          const big = Math.random() < 0.32;
          const size = big ? rng(40, 54) : rng(22, 32);
          const duration = big ? rng(3000, 3800) : rng(2200, 2900);
          // Centre 70% of the width, then a little extra jitter.
          const fromX = Math.min(
            w - 10,
            Math.max(10, w * 0.5 + (Math.random() - 0.5) * w * 0.7 + (Math.random() - 0.5) * 40),
          );
          return {
            asset: { type: "country" as const, code: next },
            from: { x: fromX, y: h + rng(20, 80) },
            // Float up and off the top — gentle horizontal sway only.
            to: { x: fromX + (Math.random() - 0.5) * 70, y: -rng(80, 220) },
            size,
            durationMs: duration,
            rotate: big ? rng(-12, 12) : rng(-22, 22),
          };
        }),
      );
    // ~40 hearts, dripped out over ~0.9s so the rise reads as a wave.
    fire(14);
    setTimeout(() => fire(12), 220);
    setTimeout(() => fire(8), 480);
    setTimeout(() => fire(6), 760);
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
        tallyEnabled?: boolean;
        homeCountryCode: string;
        nowPlayingCode: string | null;
        showStatus?: ShowStatus;
      };
      setState({
        code: data.code,
        name: data.name,
        votingEnabled: data.votingEnabled,
        tallyEnabled: !!data.tallyEnabled,
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
