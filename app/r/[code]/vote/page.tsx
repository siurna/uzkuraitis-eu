"use client";

import { useRoomLive } from "@/components/room-shell";
import { VoteForm } from "@/components/vote-form";
import { VotingClosed } from "@/components/voting-closed";

// Vote tab. Reads voting state + home country from the room context the
// layout already established — no server round-trip, so switching to
// this tab is instant.
export default function VotePage() {
  const { code, votingEnabled, homeCountryCode } = useRoomLive();
  // flex-1 (not min-h-screen) so the closed-state card fills the room
  // layout's remaining space without making the page scrollable.
  if (!votingEnabled) return <VotingClosed code={code} />;
  return <VoteForm roomCode={code} homeCountryCode={homeCountryCode} />;
}
