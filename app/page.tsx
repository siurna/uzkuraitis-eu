import { redirect } from "next/navigation";
import { RoomGate } from "@/components/room-gate";
import { findRoomByCode, normalizeRoomCode } from "@/lib/rooms";

type SearchParams = Promise<{
  room?: string | string[];
  leave?: string | string[];
}>;

// Landing page. Three paths:
//   /            → RoomGate (which may auto-redirect to a remembered room)
//   /?room=ABC   → server-side redirect into /r/ABC if it exists
//   /?leave=1    → bypass the auto-redirect, let RoomGate clear the
//                  remembered code and show the picker.
export default async function HomePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const leaving = !!params.leave;

  if (!leaving) {
    const raw = Array.isArray(params.room) ? params.room[0] : params.room;
    if (raw) {
      const code = normalizeRoomCode(raw);
      const room = await findRoomByCode(code);
      if (room) redirect(`/r/${room.code}`);
      return <RoomGate prefilled={code} />;
    }
  }

  return <RoomGate />;
}
