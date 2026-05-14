import { NextResponse } from "next/server";
import { findRoomByCode, touchRoom } from "@/lib/rooms";

type RouteCtx = { params: Promise<{ code: string }> };

export async function GET(_req: Request, { params }: RouteCtx) {
  const { code } = await params;
  const room = await findRoomByCode(code);
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }
  // Bump activity so dashboards can show "active rooms". The client
  // doesn't read the result; fire-and-forget keeps it off the
  // critical path. Errors are swallowed so a transient touch-write
  // failure never breaks the room load.
  touchRoom(room.id).catch(() => {});
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
