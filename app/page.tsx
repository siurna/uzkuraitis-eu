import { redirect } from "next/navigation";
import { RoomGate } from "@/components/room-gate";
import { findRoomByCode, normalizeRoomCode } from "@/lib/rooms";

type SearchParams = Promise<{
  room?: string | string[];
  code?: string | string[];
  leave?: string | string[];
}>;

// Landing page. Four paths:
//   /            → RoomGate (which may auto-redirect to a remembered room)
//   /?room=ABC   → legacy auto-enter — server-side redirect into /r/ABC
//                  if the room exists; middleware then bounces to
//                  /?code=ABC if the user hasn't passed Turnstile yet.
//   /?code=ABC   → middleware's bounce-back when a guest tries to deep-
//                  link without a join cookie. Show the gate prefilled,
//                  let them clear the Turnstile challenge.
//   /?leave=1    → bypass the auto-redirect, let RoomGate clear the
//                  remembered code and show the picker.
export default async function HomePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const leaving = !!params.leave;
  const pick = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] : v;

  // `?code=` is the bounce-back path from middleware — render the gate
  // prefilled, don't auto-redirect (that would loop).
  const codeParam = pick(params.code);
  if (codeParam) {
    return <RoomGate prefilled={normalizeRoomCode(codeParam)} />;
  }

  if (!leaving) {
    const raw = pick(params.room);
    if (raw) {
      const code = normalizeRoomCode(raw);
      const room = await findRoomByCode(code);
      if (room) redirect(`/r/${room.code}`);
      return <RoomGate prefilled={code} />;
    }
  }

  return <RoomGate />;
}
