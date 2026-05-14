import { createClient } from "@liveblocks/client";
import { createRoomContext } from "@liveblocks/react";

// One Liveblocks "room" per voting room. Authentication happens through
// /api/liveblocks-auth which verifies the visitor knows the room code
// before issuing a token scoped to that room only.
const client = createClient({
  authEndpoint: async (room) => {
    const response = await fetch("/api/liveblocks-auth", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ room }),
    });
    if (!response.ok) {
      throw new Error(`Liveblocks auth failed: ${response.status}`);
    }
    return response.json();
  },
  throttle: 80,
});

// Presence: who's online + tiny ephemeral state (which row they're
// hovering). Durable data lives in Postgres — Liveblocks only carries
// presence + one-shot broadcasts.
export type Presence = {
  name: string | null;
  /** Avatar id from lib/avatars.ts; null = colour+initial fallback. */
  avatar: string | null;
  emoji: string | null;
  hoveredCountry: string | null;
  /** Chat: currently composing a message. */
  typing?: boolean;
  /** Chat: ISO timestamp of the newest message this user has seen. */
  seenAt?: string | null;
  /** Stable browser-session id (mirrors lib/use-identity.ts). Lets
   *  features like the profile drawer go presence → DB without
   *  hand-matching by display name. */
  sessionId?: string | null;
};

export type Storage = Record<string, never>;

export type UserMeta = {
  id: string;
  info: {
    name: string;
    color: string;
    /** Avatar id (lib/avatars.ts) used by the presence bar. */
    avatar?: string;
  };
};

// -----------------------------------------------------------------------
// Broadcast events. Convention: `<feature>:<verb>`.
//
//   scores:updated      — server-side hint: vote was submitted, refetch
//                         /api/rooms/[code]/scores.
//   leaderboard:updated — official results changed (or tallyEnabled
//                         flipped), refetch /api/rooms/[code]/leaderboard.
//   room:updated        — room props (name, votingEnabled, tallyEnabled,
//                         homeCountryCode, code) changed; refetch room.
//   now-playing:change  — host moved the active country. Payload carries
//                         the new code so clients can swarm hearts and
//                         update the strip without a refetch race.
//
// New features should follow the same shape. When adding chat, bingo
// etc., extend the union below with `<feature>:<verb>`.

export type ScoresUpdatedEvent = { type: "scores:updated" };
export type LeaderboardUpdatedEvent = { type: "leaderboard:updated" };
export type RoomUpdatedEvent = { type: "room:updated" };
export type NowPlayingChangeEvent = {
  type: "now-playing:change";
  countryCode: string | null;
};
// Chat: server fans these out after a successful write. The new-message
// event now carries the full row inline (id + author + body/gif/meta +
// empty reactions) so clients can append without a follow-up GET — saves
// one refetch round-trip per arriving message across every connected
// client. Legacy clients without payload support still work: they fall
// back to the GET path.
//
// `quiet` = a meta/system message (now-playing banner, "X voted", show
// status…) — clients still render it, but it shouldn't bump the
// unread-chat badge on the tab bar.

// chat_messages.meta is a free-form jsonb bag (Drizzle types it as
// Record<string, unknown>). The payload uses a JSON-shaped recursive
// alias so it satisfies Liveblocks' Json constraint — callers do a
// single `as JsonObject` at the broadcast boundary.
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [k: string]: JsonValue };
export type JsonObject = { [k: string]: JsonValue };

export type ChatMessagePayload = {
  id: string;
  sessionId: string;
  name: string;
  avatarId: string | null;
  kind: string;
  body: string | null;
  gifUrl: string | null;
  replyTo: string | null;
  meta: JsonObject | null;
  createdAt: string;
};
export type ChatNewEvent = {
  type: "chat:new";
  id: string;
  quiet?: boolean;
  message?: ChatMessagePayload;
};
export type ChatReactEvent = { type: "chat:react"; id: string };
export type ChatDeleteEvent = { type: "chat:delete"; id: string };

export type RoomEvent =
  | ScoresUpdatedEvent
  | LeaderboardUpdatedEvent
  | RoomUpdatedEvent
  | NowPlayingChangeEvent
  | ChatNewEvent
  | ChatReactEvent
  | ChatDeleteEvent;

export const {
  RoomProvider,
  useRoom,
  useMyPresence,
  useOthers,
  useOthersConnectionIds,
  useOther,
  useBroadcastEvent,
  useEventListener,
  useSelf,
  useUpdateMyPresence,
  useStatus,
} = createRoomContext<Presence, Storage, UserMeta, RoomEvent>(client);
