"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useEventListener, useStatus } from "@/lib/realtime";
import { useRoomLive } from "@/components/room-shell";
import type {
  BetBreakdown,
  Bets,
  OfficialFacts,
  OfficialPlacements,
} from "@/lib/scoring";

// Single source of truth for /api/rooms/[code]/leaderboard, shared
// between the MyResults home banner and the ResultsPanel results tab.
// Before this, both components fetched the same payload independently
// — every results-tab open paid for a redundant second fetch and one
// extra leaderboard compute on the server. Now: one fetch per room,
// shared via context, refreshed on `leaderboard:updated` broadcasts.

// Mirrors lib/leaderboard.ts LeaderboardRow on the wire. Kept local
// here so the client bundle doesn't drag in the server-only scoring
// module just to type a payload.
type Row = {
  voterId: string;
  sessionId: string;
  name: string;
  homePrediction: number | null;
  topTen: number;
  home: number;
  bets: BetBreakdown;
  betPicks: Bets;
  betsTotal: number;
  highlights: number;
  trivia: number;
  total: number;
};

export type LeaderboardPayload = {
  hasResults: boolean;
  homeCountryCode: string;
  homeCountryOfficialPlacement?: number | null;
  placements: OfficialPlacements;
  facts: OfficialFacts;
  leaderboard: Row[];
};

type Ctx = {
  payload: LeaderboardPayload | null;
  refresh: () => void;
};

const Context = createContext<Ctx | null>(null);

export function useLeaderboard(): Ctx {
  // Fail open — consumers can render their "loading" state when the
  // provider isn't mounted (e.g. in a non-room context like the
  // standalone /admin pages) without throwing.
  return useContext(Context) ?? { payload: null, refresh: () => {} };
}

export function LeaderboardProvider({ children }: { children: ReactNode }) {
  const { code, tallyEnabled } = useRoomLive();
  const [payload, setPayload] = useState<LeaderboardPayload | null>(null);
  // Coalesce overlapping refreshes (mount + immediate broadcast).
  // Without this, every `leaderboard:updated` fan-out fires N copies
  // of the same query.
  const inflight = useRef<Promise<void> | null>(null);
  // Vote-storm coalesce: a 2s leading-edge throttle absorbs the
  // dozens of `scores:updated` broadcasts that fan out during a
  // ballot-tweaking window. Without it, each of 50 viewers ends up
  // GETting /leaderboard every ~50ms while the room fiddles.
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(() => {
    if (inflight.current) return;
    const p = (async () => {
      try {
        const res = await fetch(`/api/rooms/${code}/leaderboard`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as LeaderboardPayload;
        if (data.hasResults) setPayload(data);
        else setPayload(null);
      } catch {
        /* network blip — try again next event */
      }
    })().finally(() => {
      inflight.current = null;
    });
    inflight.current = p;
  }, [code]);

  // Fetch on mount regardless of `tallyEnabled` so consumers that
  // only care about the OFFICIAL placements (the ThanksCard heart
  // for the winning country, the bonus-bet result chips, etc) get
  // their data even before the room's leaderboard reveal is on.
  // The leaderboard ROWS only render when the room's `tallyEnabled`
  // is true downstream — placements alone leak no per-voter info.
  useEffect(() => {
    refresh();
  }, [refresh]);

  useEventListener(({ event }) => {
    // `leaderboard:updated` (admin entered results, edited placements,
    // etc.) is a deliberate signal — refresh immediately so the room
    // sees the reveal land. `scores:updated` (a ballot was tweaked)
    // only matters once tally is on; before that, it's a vote-storm
    // event with no payload to invalidate, so we'd be GETting a
    // "hasResults:false" reply on every keystroke for nothing.
    if (event.type === "leaderboard:updated") {
      refresh();
      return;
    }
    if (event.type === "scores:updated" && tallyEnabled) {
      if (refetchTimer.current) return;
      refetchTimer.current = setTimeout(() => {
        refetchTimer.current = null;
        refresh();
      }, 2_000);
    }
  });

  useEffect(() => {
    return () => {
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
    };
  }, []);

  // Reconnect catch-up. `leaderboard:updated` broadcasts that landed
  // while the websocket was reconnecting are lost forever otherwise;
  // refetch on the reconnecting → connected edge so the home banner
  // + results tab don't sit on a stale snapshot.
  const realtimeStatus = useStatus();
  const wasReconnecting = useRef(false);
  useEffect(() => {
    if (realtimeStatus === "reconnecting" || realtimeStatus === "disconnected") {
      wasReconnecting.current = true;
      return;
    }
    if (realtimeStatus === "connected" && wasReconnecting.current) {
      wasReconnecting.current = false;
      refresh();
    }
  }, [realtimeStatus, refresh]);

  return <Context.Provider value={{ payload, refresh }}>{children}</Context.Provider>;
}
