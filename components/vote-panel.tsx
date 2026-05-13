"use client";

import { useRoomLive } from "@/components/room-shell";
import { VoteForm } from "@/components/vote-form";
import { VotingClosed } from "@/components/voting-closed";
import { ResultsPanel } from "@/components/results-panel";

// The fourth tab. Three lives in one slot — vote, voting-closed, and
// results — so the dock tab swaps label/icon (see RoomTabBar) without
// the room having to reach for a different route. When tallyEnabled
// (the admin has revealed results), this is the breakdown + leaderboard.
// Otherwise it's the ballot, or a locked screen.
export function VotePanel() {
  const { code, votingEnabled, tallyEnabled, homeCountryCode } = useRoomLive();
  if (tallyEnabled) return <ResultsPanel />;
  if (!votingEnabled) return <VotingClosed />;
  return <VoteForm roomCode={code} homeCountryCode={homeCountryCode} />;
}
