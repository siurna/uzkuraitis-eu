"use client";

import { useRoomLive } from "@/components/room-shell";
import { VoteForm } from "@/components/vote-form";
import { VotingClosed } from "@/components/voting-closed";

// Vote tab. Reads voting state + home country from the room context the
// shell already established — no server round-trip, so switching to
// this tab is instant.
export function VotePanel() {
  const { code, votingEnabled, homeCountryCode } = useRoomLive();
  if (!votingEnabled) return <VotingClosed />;
  return <VoteForm roomCode={code} homeCountryCode={homeCountryCode} />;
}
