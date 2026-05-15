"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { RoomProvider, useEventListener } from "@/lib/realtime";
import { PresenceBar } from "@/components/presence-bar";
import { NameGate } from "@/components/name-gate";
import { RoomTabBar } from "@/components/room-tab-bar";
import { HomePanel } from "@/components/home-panel";
import { ChatPanel } from "@/components/chat-panel";
import { BingoCard } from "@/components/bingo-card";
import { VotePanel } from "@/components/vote-panel";
import { ParticleLayer } from "@/components/particle-layer";
import { CountryDeepDiveProvider } from "@/components/country-deep-dive";
import { RoomChromeProvider } from "@/lib/use-room-chrome";
import { ProfileProvider } from "@/components/profile-sheet";
import { VotingAnnouncement } from "@/components/voting-announcement";
import { NowPlayingTakeover } from "@/components/now-playing-takeover";
import { LeaderboardProvider } from "@/components/leaderboard-provider";
import { useVibeTracker } from "@/lib/use-vibe-tracker";
import { ensureSessionId } from "@/lib/use-identity";

// Tiny no-op render — just wires the vibe tracker hook into the
// React tree so it's inside RoomProvider's presence context. Kept
// separate so the hook can stay in a lib/ file with no JSX of its
// own.
function VibeTracker({ code }: { code: string }) {
  useVibeTracker({ code });
  return null;
}

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
  tallyEnabled = false,
  homeCountryCode,
  nowPlayingCode = null,
  showStatus = "not_started",
  runningOrderPos = null,
  children,
}: {
  code: string;
  name: string;
  votingEnabled: boolean;
  /** Seeded from the server so the home `MyResults` banner +
   *  ResultsPanel can render in their final state on first paint
   *  without paying for a boot `/api/rooms/[code]` round-trip. */
  tallyEnabled?: boolean;
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
      id={code}
      initialPresence={{ name: null, avatar: null, seenAt: null }}
    >
      <NameGate code={code}>
        <RoomLiveProvider
          initial={{
            code,
            name,
            votingEnabled,
            tallyEnabled,
            homeCountryCode,
            nowPlayingCode,
            showStatus: (showStatus ?? "not_started") as ShowStatus,
            runningOrderPos,
          }}
        >
          <ParticleLayer>
            <CountryDeepDiveProvider>
              <ProfileProvider>
                <LeaderboardProvider>
                  {/* Single source of truth for the header + dock
                      visibility on mobile. Replaces the earlier
                      `composing` state + `uzk:compose-focus` custom
                      event glue, which dropped signals if the focus
                      event ever failed to fire. See
                      lib/use-room-chrome.tsx. */}
                  <RoomChromeProvider>
                    <VibeTracker code={code} />
                    <NowPlayingTakeover />
                    <VotingAnnouncement />
                    {/* TriviaCard (the floating popup) was removed —
                        trivia now lands as a chat message (kind="trivia")
                        rendered inline in the thread. See
                        components/chat-trivia-inline.tsx. */}
                    <RoomBody>{children}</RoomBody>
                  </RoomChromeProvider>
                </LeaderboardProvider>
              </ProfileProvider>
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
  // Presence heartbeat — the only path now for "I'm here". Reads
  // the current session snapshot from localStorage on every beat
  // (name + avatar from the name-gate's persisted state, vibe from
  // the vibe-tracker, seenAt from the chat panel) and POSTs to
  // /api/rooms/[code]/heartbeat which upserts a voters row. WhosHere
  // and the admin active-count both consume that row via REST polls.
  //
  // Cadence: immediate beat on mount, every 30s, on
  // visibilitychange-return so a returning tab announces itself
  // before its next tick, AND a final `leaving=true` beacon on
  // pagehide so peers see the tab close almost instantly instead
  // of waiting for the 90s active-window to expire.
  useEffect(() => {
    if (!code) return;
    const buildBody = (leaving = false) => {
      const sid = ensureSessionId();
      if (!sid) return null;
      let name: string | undefined;
      let avatarId: string | undefined;
      let vibe: number | undefined;
      let seenAt: string | undefined;
      try {
        name = localStorage.getItem("uzk_name") || undefined;
        avatarId = localStorage.getItem("uzk_avatar") || undefined;
        const v = localStorage.getItem(`uzk_vibe_${code}`);
        if (v != null) {
          const n = Number(v);
          if (Number.isFinite(n)) vibe = Math.max(0, Math.round(n));
        }
        seenAt = localStorage.getItem(`uzk_seen_${code}`) || undefined;
      } catch {
        /* private mode — heartbeat still pings session, name etc just absent */
      }
      return JSON.stringify({
        session: sid,
        name,
        avatarId,
        vibe,
        seenAt,
        ...(leaving ? { leaving: true } : {}),
      });
    };
    const beat = () => {
      const body = buildBody();
      if (!body) return;
      void fetch(`/api/rooms/${code}/heartbeat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {
        /* heartbeat is best-effort */
      });
    };
    beat();
    const id = setInterval(beat, 30_000);
    const onVis = () => {
      if (document.visibilityState === "visible") beat();
    };
    // Leave beacon. `pagehide` fires on actual navigations / close
    // (and on bfcache; we let bfcache leavers fall off naturally
    // since they might be back in seconds). `navigator.sendBeacon`
    // is the only delivery guaranteed during unload — a regular
    // fetch is cancelled the moment the page unloads. The server
    // back-dates updatedAt so the row falls outside the 90s active
    // window immediately, and WhosHere drops them on its next poll.
    const onPageHide = (e: PageTransitionEvent) => {
      if (e.persisted) return; // bfcache, not a real leave
      const body = buildBody(true);
      if (!body) return;
      try {
        const blob = new Blob([body], { type: "application/json" });
        navigator.sendBeacon(`/api/rooms/${code}/heartbeat`, blob);
      } catch {
        /* sendBeacon refused (size limit / browser without it) — fall
           back to a keepalive fetch; if even that doesn't make it the
           90s active window will eventually evict us. */
        void fetch(`/api/rooms/${code}/heartbeat`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body,
          keepalive: true,
        }).catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [code]);

  const [tab, setTabState] = useState<RoomTab>("home");
  const [visited, setVisited] = useState<ReadonlySet<RoomTab>>(
    () => new Set<RoomTab>(["home"]),
  );
  const [unread, setUnread] = useState(0);
  // Header + dock visibility is owned by <RoomChromeProvider/> and
  // applied DIRECTLY by PresenceBar + RoomTabBar (both portal to
  // document.body, so a wrapper here can't reach their nodes).
  // RoomBody no longer participates in that flow.

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
          // Per-room "last tab" memory so reopening the room lands
          // on whichever tab the user left it on. Not used when a
          // deep-link ?tab= is present (that wins).
          try {
            localStorage.setItem(`uzk_last_tab_${code}`, next);
          } catch {
            /* private mode */
          }
          // Each tab starts at the top, the way a fresh screen would.
          window.scrollTo(0, 0);
        }
        return next;
      });
    },
    [code],
  );

  // On mount: deep-link ?tab= wins; otherwise restore the per-room
  // last-tab memory from localStorage so reopening feels native.
  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get("tab");
    if (isRoomTab(param) && param !== "home") {
      setTab(param);
      return;
    }
    try {
      const saved = localStorage.getItem(`uzk_last_tab_${code}`);
      if (saved && isRoomTab(saved) && saved !== "home") setTab(saved);
    } catch {
      /* ignore */
    }
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
    if (event.type !== "chat:new") return;
    if (event.quiet) return; // meta/system lines (now-playing, "X voted"…) don't badge
    if (isChat) return; // already looking at it
    setUnread((n) => Math.min(99, n + 1));
  });

  useEffect(() => {
    if (isChat) setUnread(0);
  }, [isChat]);

  useEffect(() => {
    const onSeen = () => setUnread(0);
    window.addEventListener("uzk:chat-seen", onSeen);
    return () => {
      window.removeEventListener("uzk:chat-seen", onSeen);
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
        {/* PresenceBar handles its own chrome-hidden state internally
            via useRoomChrome(). It portals to document.body, so a
            CSS-class wrapper here would never reach the rendered
            DOM node anyway. */}
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

        {/* Same as PresenceBar: RoomTabBar applies max-md:hidden to
            its own portaled DOM node via useRoomChrome(). */}
        <RoomTabBar chatUnread={unread} />
      </div>
    </RoomTabContext.Provider>
  );
}

// `display:contents` when shown → the child participates in RoomBody's
// flex column exactly as if it were rendered inline; `display:none`
// when hidden → fully out of layout but still mounted (effects, live
// subscriptions and scroll position survive).
function TabPane({ show, children }: { show: boolean; children: React.ReactNode }) {
  // `inert` while hidden — same trick the chat panel uses. Tabs are
  // kept mounted (display:none) for instant switching, but their
  // <input> elements (bonus-bets form on Vote, etc.) stay
  // discoverable by iOS Safari's form-input scanner, which then
  // renders the ‹ › ✓ multi-input accessory bar on top of OTHER
  // single-input screens (chat composer, name gate). Inert removes
  // the whole subtree from focus + AX trees, so iOS only counts the
  // active tab's inputs and renders the keyboard cleanly.
  return <div inert={!show} style={{ display: show ? "contents" : "none" }}>{children}</div>;
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

  // PERF: the boot `/api/rooms/[code]` refetch is gone — the server
  // page passes every field (code, name, votingEnabled, tallyEnabled,
  // homeCountryCode, nowPlayingCode, showStatus, runningOrderPos)
  // into <RoomShell> as props, so the very first paint already has
  // the right state. The `room:updated` broadcast handler below
  // still refetches on remote changes, so admin toggles continue to
  // propagate live.

  useEventListener(({ event }) => {
    if (event.type === "room:updated") {
      refetch();
    } else if (event.type === "now-playing:change") {
      // Bail when the broadcasted country matches what we already
      // have — without this, an admin re-tapping the same country
      // cascades a state-identity-change through every useRoomLive
      // consumer (HomePanel, ChatPanel, VotePanel, PresenceBar…).
      setState((prev) => {
        const next = event.countryCode ?? null;
        if (prev.nowPlayingCode === next) return prev;
        return { ...prev, nowPlayingCode: next };
      });
    }
  });

  return (
    <RoomLiveContext.Provider value={state}>{children}</RoomLiveContext.Provider>
  );
}
