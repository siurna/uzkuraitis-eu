import { notFound } from "next/navigation";
import { findRoomByCode } from "@/lib/rooms";
import { VoteForm } from "@/components/vote-form";
import { VotingClosed } from "@/components/voting-closed";

type RouteParams = Promise<{ code: string }>;

export default async function VotePage({ params }: { params: RouteParams }) {
  const { code } = await params;
  const room = await findRoomByCode(code);
  if (!room) notFound();

  // flex-1 (not min-h-screen) so the closed-state card fills the room
  // layout's remaining space without making the page scrollable.
  if (!room.votingEnabled) {
    return <VotingClosed code={room.code} />;
  }

  return (
    <VoteForm
      roomCode={room.code}
      homeCountryCode={room.homeCountryCode}
    />
  );
}

export const dynamic = "force-dynamic";
