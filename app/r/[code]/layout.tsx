import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { findRoomByCode, touchRoom } from "@/lib/rooms";
import { RoomShell } from "@/components/room-shell";

// Server layout for every room route (/r/[code], /r/[code]/chat, /bingo,
// /vote). Resolves the room from the URL once, hands code+name+flags +
// home country to a single client shell that owns:
//   - <NameGate/> first-run identity drawer
//   - <PresenceBar/> top header with brand mark + avatar tile
//   - <NowPlayingTakeover/> full-screen flash when a country goes on stage
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
  // Fire-and-forget — the client doesn't read the timestamp so it
  // doesn't belong on the critical path.
  touchRoom(room.id).catch(() => {});

  return (
    <RoomShell
      code={room.code}
      name={room.name}
      votingEnabled={room.votingEnabled}
      tallyEnabled={room.tallyEnabled}
      homeCountryCode={room.homeCountryCode}
      nowPlayingCode={room.nowPlayingCode}
      showStatus={room.showStatus}
      runningOrderPos={room.runningOrderPos}
    >
      {children}
    </RoomShell>
  );
}

// The `findRoomByCode` DB call + the [code] dynamic param already make
// this render per-request (so a stale code still 404s) — we drop the
// explicit `force-dynamic` so the rendered tree is client-cacheable
// (see `staleTimes` in next.config); tab switches stop re-fetching it.
