import { db } from "@/lib/db";
import { chatMessages } from "@/lib/db/schema";
import { broadcastToRoom } from "@/lib/liveblocks-server";
import { getCountry } from "@/lib/countries";
import { computeRoomLeaderboard } from "@/lib/leaderboard";

// Post a "system" chat message — the meta-narration of the room
// ("Tomas cast their vote", "Show's underway", "Voting closed"). These
// render centred + muted in the thread, never get reactions/replies.
// Best-effort: failures are swallowed so they never break the action
// that triggered them.
export async function postSystemMessage(
  roomCode: string,
  roomId: string,
  body: string,
): Promise<void> {
  try {
    const [row] = await db
      .insert(chatMessages)
      .values({
        roomId,
        sessionId: "system",
        name: "system",
        kind: "system",
        body,
      })
      .returning({ id: chatMessages.id });
    await broadcastToRoom(roomCode, { type: "chat:new", id: row.id, quiet: true });
  } catch {
    /* a missing announcement is not worth a 500 */
  }
}

// Full-width "now on stage" banner in the thread. Carries the country
// code (+ artist/song snapshot) in meta so the client can render the
// heart-flag chip; body is a plain-text fallback for push / non-rich
// surfaces. Best-effort.
export async function postNowPlayingMessage(
  roomCode: string,
  roomId: string,
  countryCode: string,
): Promise<void> {
  try {
    const c = getCountry(countryCode);
    const body = c
      ? `🎤 ${c.name} on stage${c.artist ? ` — ${c.artist}${c.song ? ` · ${c.song}` : ""}` : ""}`
      : `🎤 ${countryCode.toUpperCase()} on stage`;
    const [row] = await db
      .insert(chatMessages)
      .values({
        roomId,
        sessionId: "system",
        name: "system",
        kind: "now_playing",
        body,
        meta: { code: countryCode, artist: c?.artist ?? null, song: c?.song ?? null },
      })
      .returning({ id: chatMessages.id });
    await broadcastToRoom(roomCode, { type: "chat:new", id: row.id, quiet: true });
  } catch {
    /* not worth a 500 */
  }
}

// "🏆 Results are in" podium card — posted when the host flips the
// tally toggle on. Computes the leaderboard and carries the top 3 in
// `meta` so the client renders a podium. NOT quiet — this one's worth
// a chat badge. Pass the *post-flip* tallyEnabled (true).
export async function postResultsMessage(
  roomCode: string,
  room: { id: string; homeCountryCode: string; tallyEnabled: boolean },
): Promise<void> {
  try {
    const { hasResults, leaderboard } = await computeRoomLeaderboard(room);
    if (!hasResults || leaderboard.length === 0) {
      // No scoreable data yet — fall back to the plain announcement.
      await postSystemMessage(roomCode, room.id, "🏆 Results are in — leaderboard's live!");
      return;
    }
    const podium = leaderboard.slice(0, 3).map((r) => ({ name: r.name, total: r.total }));
    const body =
      "🏆 " + podium.map((p, i) => `${i + 1}. ${p.name} (${p.total})`).join(" · ");
    const [row] = await db
      .insert(chatMessages)
      .values({ roomId: room.id, sessionId: "system", name: "system", kind: "results", body, meta: { podium } })
      .returning({ id: chatMessages.id });
    await broadcastToRoom(roomCode, { type: "chat:new", id: row.id });
  } catch {
    /* not worth a 500 */
  }
}

// Human-readable copy for show-status transitions. English only —
// these are short status pills, not a localisation surface.
export function showStatusAnnouncement(
  status: "not_started" | "in_progress" | "break" | "ended",
): string {
  switch (status) {
    case "in_progress":
      return "🟢 The show is underway — Europe, get ready!";
    case "break":
      return "⏸ Interval break. Stretch those legs.";
    case "ended":
      return "🏁 Performances are over. Time to vote!";
    case "not_started":
    default:
      return "🎬 Doors open — the show hasn't started yet.";
  }
}
