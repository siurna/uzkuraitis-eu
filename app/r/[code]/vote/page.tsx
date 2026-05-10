import { notFound } from "next/navigation";
import { findRoomByCode } from "@/lib/rooms";
import { VoteForm } from "@/components/vote-form";

type RouteParams = Promise<{ code: string }>;

export default async function VotePage({ params }: { params: RouteParams }) {
  const { code } = await params;
  const room = await findRoomByCode(code);
  if (!room) notFound();

  if (!room.votingEnabled) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 text-center">
        <div className="glass-card p-8 rounded-xl max-w-md">
          <p className="font-display text-2xl gradient-text mb-2">
            Voting is closed
          </p>
          <p className="text-white/60 text-sm">
            The host has paused voting in <strong>{room.name}</strong>. The
            standings page is still live.
          </p>
        </div>
      </main>
    );
  }

  return (
    <VoteForm
      roomCode={room.code}
      roomName={room.name}
      homeCountryCode={room.homeCountryCode}
    />
  );
}

export const dynamic = "force-dynamic";
