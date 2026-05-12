import { NextResponse } from "next/server";
import { findRoomByCode, touchRoom } from "@/lib/rooms";

type RouteCtx = { params: Promise<{ code: string }> };

export async function GET(_req: Request, { params }: RouteCtx) {
  const { code } = await params;
  const room = await findRoomByCode(code);
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }
  // Bump activity so dashboards can show "active rooms".
  await touchRoom(room.id);
  return NextResponse.json({
    id: room.id,
    code: room.code,
    name: room.name,
    votingEnabled: room.votingEnabled,
    tallyEnabled: room.tallyEnabled,
    homeCountryCode: room.homeCountryCode,
    nowPlayingCode: room.nowPlayingCode,
    showStatus: room.showStatus,
    runningOrderPos: room.runningOrderPos,
  });
}
