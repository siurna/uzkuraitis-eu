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
import { useEventListener } from "@/lib/realtime";
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

  useEffect(() => {
    if (tallyEnabled) refresh();
  }, [tallyEnabled, refresh]);

  useEventListener(({ event }) => {
    // Both leaderboard:updated (admin entered results) and
    // scores:updated (a fresh ballot landed) invalidate the cached
    // payload — the leaderboard's totals fold in those ballots.
    if (event.type === "leaderboard:updated" || event.type === "scores:updated") {
      refresh();
    }
  });

  return <Context.Provider value={{ payload, refresh }}>{children}</Context.Provider>;
}
