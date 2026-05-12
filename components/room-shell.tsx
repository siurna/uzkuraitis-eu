"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { RoomProvider, useEventListener } from "@/lib/liveblocks";
import { PresenceBar } from "@/components/presence-bar";
import { NameGate } from "@/components/name-gate";
import { RoomTabBar } from "@/components/room-tab-bar";
import { HomePanel } from "@/components/home-panel";
import { ChatPanel } from "@/components/chat-panel";
import { BingoCard } from "@/components/bingo-card";
import { VotePanel } from "@/components/vote-panel";
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
  /** 1-based act position in the running order (e.g. 12 of 26), or null. */
  runningOrderPos: number | null;
};

const RoomLiveContext = createContext<RoomLive | null>(null);

export function useRoomLive(): RoomLive {
  const ctx = useContext(RoomLiveContext);
  if (!ctx) throw new Error("useRoomLive must be used inside <RoomShell>");
  return ctx;
}

// ---- Tab context ---------------------------------------------------
// The room is a single-page app: Home / Chat / Bingo / Vote are panels
// kept mounted side-by-side, not routes. Switching is pure setState —
// zero navigation, zero RSC fetch, panels keep their scroll + state +
// live subscriptions. Deep links (/r/x/chat, push notifications) land
// on the redirect shims which bounce to /r/x?tab=chat; <TabSync> reads
// that param once on mount.
export type RoomTab = "home" | "chat" | "bingo" | "vote";
const ROOM_TABS: readonly RoomTab[] = ["home", "chat", "bingo", "vote"];

type RoomTabCtx = { tab: RoomTab; setTab: (t: RoomTab) => void };
const RoomTabContext = createContext<RoomTabCtx | null>(null);

export function useRoomTab(): RoomTabCtx {
  const ctx = useContext(RoomTabContext);
  if (!ctx) throw new Error("useRoomTab must be used inside <RoomShell>");
  return ctx;
}

export function isRoomTab(v: unknown): v is RoomTab {
  return typeof v === "string" && (ROOM_TABS as readonly string[]).includes(v);
}

export function RoomShell({
  code,
  name,
  votingEnabled,
  homeCountryCode,
  nowPlayingCode = null,
  showStatus = "not_started",
  runningOrderPos = null,
  children,
}: {
  code: string;
  name: string;
  votingEnabled: boolean;
  homeCountryCode: string;
  // Seeded from the server so the now-playing hero (Home) and the header
  // strip render in their final state on first paint — no content shift.
  nowPlayingCode?: string | null;
  showStatus?: string;
  runningOrderPos?: number | null;
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
            nowPlayingCode,
            showStatus: (showStatus ?? "not_started") as ShowStatus,
            runningOrderPos,
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

// Body / tab switcher. Holds the active tab + the set of tabs that have
// been opened (we mount a panel lazily the first time it's shown, then
// keep it mounted so re-entering is instant and stateful — like a
// native view controller stack). Inactive in-flow panels collapse to
// `display:none`; the chat panel is `position:fixed` and hides itself
// via its `active` prop. The unread-chat counter lives here so the tab
// bar can badge it.
function RoomBody({ children }: { children: React.ReactNode }) {
  const { code } = useRoomLive();
  const [tab, setTabState] = useState<RoomTab>("home");
  const [visited, setVisited] = useState<ReadonlySet<RoomTab>>(
    () => new Set<RoomTab>(["home"]),
  );
  const [unread, setUnread] = useState(0);
  // Hide the bottom dock while the chat composer is focused — on iOS the
  // keyboard otherwise stacks it over the input.
  const [composing, setComposing] = useState(false);

  const isHome = tab === "home";
  const isChat = tab === "chat";

  const setTab = useCallback(
    (next: RoomTab) => {
      setVisited((v) => (v.has(next) ? v : new Set(v).add(next)));
      setTabState((cur) => {
        if (cur === next) return cur;
        // Keep the URL honest (back button / refresh / share) without a
        // navigation: this is a replace, not a push.
        if (typeof window !== "undefined") {
          const url = next === "home" ? `/r/${code}` : `/r/${code}?tab=${next}`;
          window.history.replaceState(window.history.state, "", url);
          // Each tab starts at the top, the way a fresh screen would.
          window.scrollTo(0, 0);
        }
        return next;
      });
    },
    [code],
  );

  // Read ?tab= once on mount (deep links / redirect shims land here).
  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get("tab");
    if (isRoomTab(param) && param !== "home") setTab(param);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lock document scroll on the chat tab — the chat panel owns the
  // whole viewport between the header and the dock, so any document
  // scroll (e.g. a drag that starts on the fixed header) is a bug.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("tab-chat", isChat);
    return () => root.classList.remove("tab-chat");
  }, [isChat]);

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
    <RoomTabContext.Provider value={{ tab, setTab }}>
      {/* The header is `fixed`, so pad the flow content down past it
          (+ the iOS notch). On the chat tab the panel is fixed too, so
          the page itself must not scroll — lock it to the viewport. */}
      <div
        className={`flex flex-col pb-24 pt-[calc(env(safe-area-inset-top)+3.5rem)] ${
          isChat ? "h-[100dvh] overflow-hidden" : "min-h-dvh"
        }`}
      >
        <PresenceBar />
        {/* <TabSync> + anything the route segment renders (no UI). */}
        {children}

        <TabPane show={isHome}>
          <HomePanel />
        </TabPane>
        {visited.has("bingo") && (
          <TabPane show={tab === "bingo"}>
            <BingoCard />
          </TabPane>
        )}
        {visited.has("vote") && (
          <TabPane show={tab === "vote"}>
            <VotePanel />
          </TabPane>
        )}
        {/* Chat is `position:fixed` — it manages its own visibility. */}
        {visited.has("chat") && <ChatPanel active={isChat} />}

        {!composing && <RoomTabBar chatUnread={unread} />}
      </div>
    </RoomTabContext.Provider>
  );
}

// `display:contents` when shown → the child participates in RoomBody's
// flex column exactly as if it were rendered inline; `display:none`
// when hidden → fully out of layout but still mounted (effects, live
// subscriptions and scroll position survive).
function TabPane({ show, children }: { show: boolean; children: React.ReactNode }) {
  return <div style={{ display: show ? "contents" : "none" }}>{children}</div>;
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
    // A big "release of balloons": hearts launch from below the fold and
    // shoot most of the way up the screen (and beyond) before they fade —
    // not a polite little fizzle near the bottom. Wide size + speed bands
    // for parallax; spawn X is centre-weighted so it reads as a burst
    // from the stage, with a generous sway as they climb.
    const rng = (a: number, b: number) => a + Math.random() * (b - a);
    const fire = (n: number) =>
      particles.spawnMany(
        Array.from({ length: n }, () => {
          const big = Math.random() < 0.35;
          const size = big ? rng(56, 88) : rng(30, 52);
          // They travel most of the screen, so give them time — a slow,
          // graceful float, not a blur.
          const duration = big ? rng(3800, 5400) : rng(2800, 4000);
          // Centre 80% of the width, plus a bit of jitter.
          const fromX = Math.min(
            w - 10,
            Math.max(10, w * 0.5 + (Math.random() - 0.5) * w * 0.8 + (Math.random() - 0.5) * 50),
          );
          return {
            asset: { type: "country" as const, code: next },
            from: { x: fromX, y: h + rng(20, 80) },
            // Climb 75–130% of the viewport height past the top — they
            // travel the whole screen — with a wide sideways drift.
            to: { x: fromX + (Math.random() - 0.5) * 130, y: -rng(h * 0.75, h * 1.3) },
            size,
            durationMs: duration,
            rotate: big ? rng(-14, 14) : rng(-26, 26),
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
        runningOrderPos?: number | null;
      };
      setState({
        code: data.code,
        name: data.name,
        votingEnabled: data.votingEnabled,
        tallyEnabled: !!data.tallyEnabled,
        homeCountryCode: data.homeCountryCode ?? initial.homeCountryCode,
        nowPlayingCode: data.nowPlayingCode ?? null,
        showStatus: data.showStatus ?? "not_started",
        runningOrderPos: data.runningOrderPos ?? null,
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
