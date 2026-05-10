import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { findRoomByCode, touchRoom } from "@/lib/rooms";
import { RoomShell } from "@/components/room-shell";

// Server layout for every room route (/r/[code], /r/[code]/chat, /bingo,
// /vote). Resolves the room from the URL once, hands code+name+flags +
// home country to a single client shell that owns:
//   - <NameGate/> first-run identity drawer
//   - <PresenceBar/> top header with brand mark + avatar tile
//   - <NowPlaying/> strip (TODO when feature lands)
//   - <RoomTabBar/> sticky bottom nav (mobile) / sticky top (desktop)
//   - <ParticleLayer/> the one place flying hearts / emoji / swarms live
//   - room live context (props that flip when admin toggles)
type RouteParams = Promise<{ code: string }>;

export default async function RoomLayout({
  params,
  children,
}: {
  params: RouteParams;
  children: ReactNode;
}) {
  const { code } = await params;
  const room = await findRoomByCode(code);
  if (!room) notFound();
  await touchRoom(room.id);

  return (
    <RoomShell
      code={room.code}
      name={room.name}
      votingEnabled={room.votingEnabled}
      homeCountryCode={room.homeCountryCode}
    >
      {children}
    </RoomShell>
  );
}

// Force dynamic so deep links always re-resolve the room (and 404 cleanly
// when the code is stale).
export const dynamic = "force-dynamic";
