import { NextResponse } from "next/server";
import { findRoomByCode } from "@/lib/rooms";
import { computeRoomLeaderboard } from "@/lib/leaderboard";

type RouteCtx = { params: Promise<{ code: string }> };

// Per-room betting leaderboard. Returns the "waiting" shape if no
// official result has been entered yet (or the tally toggle is off) so
// the UI doesn't need a second request.
export async function GET(_req: Request, { params }: RouteCtx) {
  const { code } = await params;
  const room = await findRoomByCode(code);
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const result = await computeRoomLeaderboard(room);
  if (!result.hasResults) {
    return NextResponse.json({
      hasResults: false,
      tallyEnabled: result.tallyEnabled,
      homeCountryCode: result.homeCountryCode,
      leaderboard: [],
    });
  }
  return NextResponse.json({
    hasResults: true,
    homeCountryCode: result.homeCountryCode,
    homeCountryOfficialPlacement: result.homeCountryOfficialPlacement,
    leaderboard: result.leaderboard,
  });
}
