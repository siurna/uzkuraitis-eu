import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  chatMessages,
  commentator,
  rooms,
  COMMENTATOR_NAME_KEY,
  COMMENTATOR_PHOTO_KEY,
} from "@/lib/db/schema";
import { broadcastToRoom } from "@/lib/realtime-server";
import { getCountry } from "@/lib/countries";
import { computeRoomLeaderboard } from "@/lib/leaderboard";
import { getTriviaMerged } from "@/lib/trivia-store";
import type { ChatMessagePayload, JsonObject } from "@/lib/realtime";

// A system chat message, identified by its i18n key (+ optional arg).
// The client renders it in the *recipient's* language from meta.sysKey;
// `body` stays null (the client never needs it for these).
//
// `data` is a free-form bag for rich-render cards (e.g. the top-3
// broadcast carries `{ codes: ["fi","se","it"] }` so the client can
// build a real podium rather than parsing a flag-and-name string).
export type SystemMsg = {
  key: string;
  arg?: string;
  data?: Record<string, unknown>;
};

// Row-out-of-Drizzle → broadcast-shaped payload. `meta` is a jsonb bag
// the inserter built — opaque to TS — so we cast it at the boundary.
export function toChatPayload(
  row: typeof chatMessages.$inferSelect,
): ChatMessagePayload {
  return {
    id: row.id,
    sessionId: row.sessionId,
    name: row.name,
    avatarId: row.avatarId,
    kind: row.kind,
    body: row.body,
    gifUrl: row.gifUrl,
    replyTo: row.replyTo,
    meta: row.meta as JsonObject | null,
    createdAt: row.createdAt.toISOString(),
  };
}

// Post a "system" chat message — the meta-narration of the room
// ("Tomas cast their vote", "Show's underway", "Voting closed"). These
// render centred + muted in the thread, never get reactions/replies.
// Best-effort: failures are swallowed so they never break the action
// that triggered them.
export async function postSystemMessage(
  roomCode: string,
  roomId: string,
  sys: SystemMsg,
): Promise<boolean> {
  try {
    const [row] = await db
      .insert(chatMessages)
      .values({
        roomId,
        sessionId: "system",
        name: "system",
        kind: "system",
        body: null,
        meta: {
          sysKey: sys.key,
          sysArg: sys.arg ?? null,
          ...(sys.data ?? {}),
        },
      })
      .returning();
    await broadcastToRoom(roomCode, {
      type: "chat:new",
      id: row.id,
      quiet: true,
      message: toChatPayload(row),
    });
    return true;
  } catch {
    /* a missing announcement is not worth a 500 — caller can surface
       the false return if they want admin-visible diagnostics. */
    return false;
  }
}

// Inline trivia card posted as a chat message. Snapshots the full
// question payload into `meta` so the card survives admin deck edits
// in flight: the client always renders the question that was live
// when the card was posted. Quiet on purpose — trivia firing
// shouldn't bump the chat-unread badge; the card is its own
// attention signal.
//
// CALLED from the admin's browser, NOT from the now-playing flip.
// The admin live panel runs its own setTimeout (30s–2:30 after a
// country takes the stage) and POSTs to /api/admin/live/trivia,
// which calls into here. Keeps the dramatic mid-song reveal without
// a Vercel function ever holding a long-running timer — the
// admin's tab is the scheduler.
export async function postTriviaMessage(
  roomCode: string,
  roomId: string,
  countryCode: string,
): Promise<boolean> {
  try {
    const card = await getTriviaMerged(countryCode);
    if (!card) return false;
    const [row] = await db
      .insert(chatMessages)
      .values({
        roomId,
        sessionId: "system",
        name: "system",
        kind: "trivia",
        body: null,
        meta: {
          countryCode,
          correctIndex: card.correctIndex,
          en: { question: card.en.question, choices: [...card.en.choices] },
          lt: { question: card.lt.question, choices: [...card.lt.choices] },
        },
      })
      .returning();
    await broadcastToRoom(roomCode, {
      type: "chat:new",
      id: row.id,
      quiet: true,
      message: toChatPayload(row),
    });
    return true;
  } catch {
    return false;
  }
}

// Full-width "now on stage" banner in the thread. Carries the country
// code (+ artist/song snapshot) in meta so the client renders the
// heart-flag chip and country name in the viewer's language. `body`
// stays null — the client doesn't read it. Best-effort.
export async function postNowPlayingMessage(
  roomCode: string,
  roomId: string,
  countryCode: string,
): Promise<boolean> {
  try {
    const c = getCountry(countryCode);
    const [row] = await db
      .insert(chatMessages)
      .values({
        roomId,
        sessionId: "system",
        name: "system",
        kind: "now_playing",
        body: null,
        meta: { code: countryCode, artist: c?.artist ?? null, song: c?.song ?? null },
      })
      .returning();
    await broadcastToRoom(roomCode, {
      type: "chat:new",
      id: row.id,
      quiet: true,
      message: toChatPayload(row),
    });
    return true;
  } catch {
    return false;
  }
}

// Quick poll card the host fires from admin broadcasts. Carries the
// question + 4 emoji choices in meta so each viewer can render the
// card in their own language without a round-trip. Votes ride on the
// existing chat_reactions table — one reaction = one vote, with the
// client enforcing single-choice — so the chat:react broadcast on the
// existing reaction endpoint keeps every viewer's tally bar live for
// free. NOT quiet on purpose: a fresh poll is worth a chat-tab badge.
export type PollChoice = {
  emoji: string;
  en: string;
  lt: string;
};

export async function postPollMessage(
  roomCode: string,
  roomId: string,
  question: { en: string; lt: string },
  choices: PollChoice[],
): Promise<boolean> {
  try {
    const [row] = await db
      .insert(chatMessages)
      .values({
        roomId,
        sessionId: "system",
        name: "system",
        kind: "poll",
        body: null,
        meta: {
          poll: true,
          question,
          // Snapshot the choices into meta so admin edits to the
          // canned poll list don't rewrite cards already in the thread.
          choices,
        },
      })
      .returning();
    await broadcastToRoom(roomCode, {
      type: "chat:new",
      id: row.id,
      message: toChatPayload(row),
    });
    return true;
  } catch {
    return false;
  }
}

// "🏆 Results are in" podium card — posted when the host flips the
// tally toggle on. Computes the leaderboard and carries the top 3 in
// `meta` so the client renders a podium. NOT quiet — this one's worth
// a chat badge. Pass the *post-flip* tallyEnabled (true).
export async function postResultsMessage(
  roomCode: string,
  room: {
    id: string;
    homeCountryCode: string;
    tallyEnabled: boolean;
    highlightThreshold?: number | null;
  },
): Promise<boolean> {
  try {
    const { hasResults, leaderboard } = await computeRoomLeaderboard(room);
    if (!hasResults || leaderboard.length === 0) {
      // No scoreable data yet — fall back to the plain announcement.
      return await postSystemMessage(roomCode, room.id, { key: "sys_results_in" });
    }
    const podium = leaderboard.slice(0, 3).map((r) => ({ name: r.name, total: r.total }));
    const body =
      "🏆 " + podium.map((p, i) => `${i + 1}. ${p.name} (${p.total})`).join(" · ");
    const [row] = await db
      .insert(chatMessages)
      .values({ roomId: room.id, sessionId: "system", name: "system", kind: "results", body, meta: { podium } })
      .returning();
    await broadcastToRoom(roomCode, {
      type: "chat:new",
      id: row.id,
      message: toChatPayload(row),
    });
    return true;
  } catch {
    return false;
  }
}

// The "live commentator": once a country is on stage, if a bot name is
// configured AND a line exists for that country, the bot drops the line
// into chat as its own (non-system) message, carrying its photo in meta
// so the client renders it as the bot's avatar. Best-effort; quiet (it
// fires every song, no point badging the tab each time).
export async function postCommentatorMessage(
  roomCode: string,
  roomId: string,
  countryCode: string,
): Promise<boolean> {
  try {
    const [room] = await db
      .select({ on: rooms.commentatorEnabled })
      .from(rooms)
      .where(eq(rooms.id, roomId))
      .limit(1);
    if (room && room.on === false) return false; // host muted the bot for this room
    const rows = await db
      .select()
      .from(commentator)
      .where(inArray(commentator.countryCode, [countryCode, COMMENTATOR_NAME_KEY, COMMENTATOR_PHOTO_KEY]));
    const byKey = new Map(rows.map((r) => [r.countryCode, r.text]));
    const name = byKey.get(COMMENTATOR_NAME_KEY)?.trim();
    const line = byKey.get(countryCode)?.trim();
    if (!name || !line) return false; // bot not set up, or nothing to say for this country
    const photo = byKey.get(COMMENTATOR_PHOTO_KEY)?.trim() || null;
    // Hold the commentator line off-screen until the now-playing
    // takeover finishes (~5.2s hold + ~0.5s fade out in
    // components/now-playing-takeover.tsx). Without this, the bot's
    // chat row pops into the thread while the takeover is still
    // washing across the screen — two attention-grabs at once. The
    // chat-row's DelayedTrivia-style gate watches `meta.firesAt`
    // and renders nothing until the timestamp passes.
    const TAKEOVER_HOLD_MS = 5500;
    const firesAt = new Date(Date.now() + TAKEOVER_HOLD_MS).toISOString();
    const [row] = await db
      .insert(chatMessages)
      .values({
        roomId,
        sessionId: "commentator",
        name,
        kind: "text",
        body: line,
        meta: {
          commentator: true,
          commentatorPhoto: photo,
          nowPlaying: countryCode,
          firesAt,
        },
      })
      .returning();
    await broadcastToRoom(roomCode, {
      type: "chat:new",
      id: row.id,
      quiet: true,
      message: toChatPayload(row),
    });
    return true;
  } catch {
    return false;
  }
}

// The i18n key for a show-status transition announcement.
export function showStatusAnnouncement(
  status: "not_started" | "in_progress" | "break" | "ended",
): SystemMsg {
  switch (status) {
    case "in_progress":
      return { key: "sys_show_started" };
    case "break":
      return { key: "sys_show_break" };
    case "ended":
      return { key: "sys_show_ended" };
    case "not_started":
    default:
      return { key: "sys_show_doors" };
  }
}
