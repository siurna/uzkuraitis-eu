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
// hovering). Durable data lives in Neon — Liveblocks only carries
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
//   reaction:emoji      — a user tapped an emoji on the reactions bar
//                         (clients spawn a floating particle).
//   reaction:country    — a user tapped a country-specific reaction
//                         (admin reactions panel etc).
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

export type ReactionEmojiEvent = {
  type: "reaction:emoji";
  emoji: string;
  x: number;
  y: number;
};
export type ReactionCountryEvent = {
  type: "reaction:country";
  emoji: string;
  countryCode: string;
};
export type ScoresUpdatedEvent = { type: "scores:updated" };
export type LeaderboardUpdatedEvent = { type: "leaderboard:updated" };
export type RoomUpdatedEvent = { type: "room:updated" };
export type NowPlayingChangeEvent = {
  type: "now-playing:change";
  countryCode: string | null;
};
export type BingoStrikeEvent = {
  type: "bingo:strike";
  by: string;        // voter name
  trope: string;     // the trope string (already localised by sender)
  bingo?: boolean;   // true when the strike completed a row/col/diag
};
// Chat: server fans these out after a successful write. Body intention-
// ally minimal — clients refetch the message slice they need.
// `quiet` = a meta/system message (now-playing banner, "X voted", show
// status…) — clients still render it, but it shouldn't bump the
// unread-chat badge on the tab bar.
export type ChatNewEvent = { type: "chat:new"; id: string; quiet?: boolean };
export type ChatReactEvent = { type: "chat:react"; id: string };
export type ChatDeleteEvent = { type: "chat:delete"; id: string };

export type RoomEvent =
  | ReactionEmojiEvent
  | ReactionCountryEvent
  | ScoresUpdatedEvent
  | LeaderboardUpdatedEvent
  | RoomUpdatedEvent
  | NowPlayingChangeEvent
  | BingoStrikeEvent
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
