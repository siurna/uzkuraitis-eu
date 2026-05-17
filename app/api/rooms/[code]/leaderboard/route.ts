import { NextResponse } from "next/server";
import { findRoomByCode } from "@/lib/rooms";
import {
  computeRoomLeaderboard,
  readLeaderboardSnapshot,
} from "@/lib/leaderboard";
import type { RoomLeaderboard } from "@/lib/leaderboard";

type RouteCtx = { params: Promise<{ code: string }> };

// Per-room betting leaderboard. Returns the "waiting" shape if no
// official result has been entered yet (or the tally toggle is off) so
// the UI doesn't need a second request.
//
// Snapshot-first: when admin acts on results / facts / tally, the
// computed payload is persisted to `rooms.leaderboard_snapshot`. We
// read that here (a single tiny SELECT) and skip the heavy multi-
// table compute entirely. If the snapshot is missing — pre-tally,
// or before the ALTER TABLE was applied — we fall through to
// computeRoomLeaderboard which still has the Lambda memo + edge
// cache on top.
export async function GET(_req: Request, { params }: RouteCtx) {
  const { code } = await params;
  const room = await findRoomByCode(code);
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  let result: RoomLeaderboard | null = null;
  if (room.tallyEnabled) {
    // Try the snapshot first. Caps staleness at 1 hour so a snapshot
    // forgotten on a long-dead room can't masquerade as fresh truth
    // forever; admin actions always overwrite within that window.
    result = await readLeaderboardSnapshot(room.id, 60 * 60 * 1_000);
  }
  if (!result) {
    result = await computeRoomLeaderboard({
      id: room.id,
      homeCountryCode: room.homeCountryCode,
      tallyEnabled: room.tallyEnabled,
      highlightThreshold: room.highlightThreshold,
    });
  }
  // CHEAT GUARD: pre-tally, every piece of result data is scrubbed
  // from this public response. Earlier we rode `placements` + `facts`
  // along on the unrevealed shape so the ThanksCard's winning-country
  // heart could pulse the moment the admin saved a placement — but
  // any anonymous poller could read placements + lt_total_points +
  // jury_winner + etc the second they hit the admin's table, then
  // overwrite their own ballot and side bets with the truth. Ballots
  // remain editable until tallyEnabled flips (see votes/route.ts
  // for the matching server-side block), so the leak was a real
  // game-integrity bug. ThanksCard now fires post-tally only, which
  // is the canonical "results are in" moment anyway.
  const body = !result.hasResults
    ? {
        hasResults: false as const,
        tallyEnabled: result.tallyEnabled,
        homeCountryCode: result.homeCountryCode,
        homeCountryOfficialPlacement: null,
        placements: {},
        facts: {},
        leaderboard: [],
      }
    : {
        hasResults: true as const,
        homeCountryCode: result.homeCountryCode,
        homeCountryOfficialPlacement: result.homeCountryOfficialPlacement,
        placements: result.placements,
        facts: result.facts,
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
    // Edge cache tuned for mid-show: admin can re-reveal facts /
    // re-enter placements during the broadcast, and viewers expect
    // the leaderboard to follow within seconds. 10s fresh + 60s
    // SWR is the right balance against the heavy compute. The
    // Lambda-level memo (30s, computeRoomLeaderboard) covers
    // the dedup on cold CDN, and admin writes proactively warm the
    // memo via broadcastLeaderboardUpdate.
    res.headers.set(
      "Cache-Control",
      "public, s-maxage=10, stale-while-revalidate=60",
    );
  } else {
    res.headers.set("Cache-Control", "no-store");
  }
  return res;
}
