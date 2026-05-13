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

  // PERF: cache only AFTER results are finalised. The 5s+swr=30
  // window I had on the unrevealed response was the bug behind
  // "stuck on loading when I reveal results" — the edge served a
  // stale `hasResults: false` for up to 35s after the host flipped
  // the tally, leaving clients spinning. Pre-reveal stays no-store
  // so the moment the host enters results, the next fetch reflects.
  // Post-reveal data is final and can sit on the edge.
  const res = NextResponse.json(body);
  if (result.hasResults) {
    res.headers.set(
      "Cache-Control",
      "public, s-maxage=10, stale-while-revalidate=60",
    );
  } else {
    res.headers.set("Cache-Control", "no-store");
  }
  return res;
}
