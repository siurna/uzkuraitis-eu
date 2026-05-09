import { createClient } from "@liveblocks/client";
import { createRoomContext } from "@liveblocks/react";

// One Liveblocks "room" per voting room. Authentication happens through the
// /api/liveblocks-auth route which verifies the visitor knows the room code
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

// Presence: who's online + which row they're hovering. Storage stays small —
// durable scoreboard data lives in Neon, Liveblocks only carries ephemeral UX.
export type Presence = {
  name: string | null;
  emoji: string | null;
  hoveredCountry: string | null;
};

export type Storage = Record<string, never>;

export type UserMeta = {
  id: string;
  info: {
    name: string;
    color: string;
  };
};

// One-shot reactions broadcast to everyone in the room. Both the floating
// emoji bar and the per-country counter button push these events.
export type ReactionEvent =
  | { type: "floating"; emoji: string; x: number; y: number }
  | { type: "country"; emoji: string; countryCode: string };

export type RoomEvent = ReactionEvent;

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
