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
  const res = NextResponse.json({
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
  // Match the in-process room cache TTL — the next read inside the
  // 5-second window can land at the edge instead of origin. Live
  // updates fan out via the room:updated broadcast.
  res.headers.set(
    "Cache-Control",
    "public, s-maxage=5, stale-while-revalidate=30",
  );
  return res;
}
