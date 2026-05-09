import { redirect } from "next/navigation";
import { RoomGate } from "@/components/room-gate";
import { findRoomByCode, normalizeRoomCode } from "@/lib/rooms";

type SearchParams = Promise<{ room?: string | string[] }>;

// Landing page. Two paths:
//   /            → show RoomGate (enter a code or create a new room)
//   /?room=ABC123 → if the room exists, redirect into /r/ABC123
export default async function HomePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const raw = Array.isArray(params.room) ? params.room[0] : params.room;
  if (raw) {
    const code = normalizeRoomCode(raw);
    const room = await findRoomByCode(code);
    if (room) redirect(`/r/${room.code}`);
  }

  return <RoomGate prefilled={raw ? normalizeRoomCode(raw) : ""} />;
}
