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
  const body = !result.hasResults
    ? {
        hasResults: false as const,
        tallyEnabled: result.tallyEnabled,
        homeCountryCode: result.homeCountryCode,
        leaderboard: [],
      }
    : {
        hasResults: true as const,
        homeCountryCode: result.homeCountryCode,
        homeCountryOfficialPlacement: result.homeCountryOfficialPlacement,
        leaderboard: result.leaderboard,
      };

  // PERF: leaderboard rendering is heavy (joins voters, votes, chat,
  // chat reactions, trivia). When the host hits "reveal results" all
  // 30+ clients fetch in unison; a 5s edge cache + 30s SWR collapses
  // that thundering herd to one origin call. Updates still feel
  // immediate (5s ceiling).
  const res = NextResponse.json(body);
  res.headers.set(
    "Cache-Control",
    "public, s-maxage=5, stale-while-revalidate=30",
  );
  return res;
}
