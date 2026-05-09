import { notFound } from "next/navigation";
import { findRoomByCode, touchRoom } from "@/lib/rooms";
import { RoomShell } from "@/components/room-shell";

type RouteParams = Promise<{ code: string }>;

export default async function RoomPage({ params }: { params: RouteParams }) {
  const { code } = await params;
  const room = await findRoomByCode(code);
  if (!room) notFound();

  await touchRoom(room.id);

  return (
    <RoomShell
      code={room.code}
      name={room.name}
      votingEnabled={room.votingEnabled}
    />
  );
}

// Make sure deep links always go through SSR so wrong codes 404 cleanly.
export const dynamic = "force-dynamic";
