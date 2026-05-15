"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getBrowserSupabase } from "./supabase";

// Realtime layer for one voting room. Wraps Supabase Realtime so the
// rest of the app keeps the same `useMyPresence` / `useOthers` /
// `useBroadcastEvent` shape we had on Liveblocks. Two transports:
//
// - Presence: each browser tab joins `room:<code>` with a stable
//   per-tab key and `track()`s its Presence object. The channel's
//   sync event tells everyone the full presence map.
//
// - Broadcasts: every event in the RoomEvent union is wrapped in a
//   single Supabase broadcast event named "msg" with the typed
//   payload. One subscription handles every event type via the
//   payload's discriminant — matches how the union was already used.
//
// Servers don't open websockets; they POST to Supabase's broadcast
// REST endpoint via `serverBroadcast()` in lib/supabase.ts.

export type Presence = {
  name: string | null;
  /** Avatar id from lib/avatars.ts; null = colour+initial fallback. */
  avatar: string | null;
  /** Chat: ISO timestamp of the newest message this user has seen. */
  seenAt?: string | null;
  /** Stable browser-session id (mirrors lib/use-identity.ts). Lets
   *  features like the profile drawer go presence → DB without
   *  hand-matching by display name. */
  sessionId?: string | null;
  /** Engagement score for the avatar mood ring in WhosHere — each
   *  client bumps its own via `useVibeTracker` on observed local
   *  actions (message sent, reaction sent, bingo strike, vote cast,
   *  bet saved, trivia answered) and pushes it into presence so the
   *  rest of the room can colour their bubble. Persisted in
   *  localStorage per-room so it survives reload during the show. */
  vibe?: number;
};

export type UserInfo = {
  name: string;
  color: string;
  /** Avatar id (lib/avatars.ts) used by the presence bar. */
  avatar?: string;
};

// -----------------------------------------------------------------------
// Broadcast events. Convention: `<feature>:<verb>`. Mirrors the union
// that lib/liveblocks.ts used to export so call sites don't need to
// change beyond the import path.

export type ScoresUpdatedEvent = { type: "scores:updated" };
export type LeaderboardUpdatedEvent = { type: "leaderboard:updated" };
export type RoomUpdatedEvent = { type: "room:updated" };
export type NowPlayingChangeEvent = {
  type: "now-playing:change";
  countryCode: string | null;
};

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
export type ChatReactEvent = {
  type: "chat:react";
  id: string;
  // Delta payload — present on broadcasts from the current server.
  // When all four are set the listener can patch the affected
  // message's reactions map locally instead of firing a full
  // 50-row GET. Falls back to refetch when fields are missing
  // (older server) or when the message id isn't in the window.
  emoji?: string;
  added?: boolean;
  sessionId?: string;
  name?: string;
};
export type ChatDeleteEvent = { type: "chat:delete"; id: string };
// Typing indicator runs as a broadcast, not as presence. Reason:
// Supabase presence is rate-limited at ~1/sec per client; chasing a
// typing flag on every keystroke blew past that and got the tab
// kicked off the channel. Broadcasts have a much higher ceiling and
// fire instantly. The shape carries enough for the listener to
// render "Danny is typing…" with no DB lookup. `typing:start` is
// resent every 4s as a keepalive — listeners auto-expire entries
// 6s after the last start so a typer who closed the tab doesn't
// leave a ghost indicator running forever.
export type ChatTypingStartEvent = {
  type: "typing:start";
  sessionId: string;
  name: string;
};
export type ChatTypingStopEvent = {
  type: "typing:stop";
  sessionId: string;
};
// Edit echo carries the new body + meta directly so listeners can
// patch the existing row in place. Previously edits piggybacked on
// `chat:react` which routed through the 600ms throttled refetch —
// fine for reactions, sluggish for edits. The full message payload
// avoids a follow-up GET.
export type ChatEditEvent = {
  type: "chat:edit";
  id: string;
  message: ChatMessagePayload;
};

export type RoomEvent =
  | ScoresUpdatedEvent
  | LeaderboardUpdatedEvent
  | RoomUpdatedEvent
  | NowPlayingChangeEvent
  | ChatNewEvent
  | ChatReactEvent
  | ChatDeleteEvent
  | ChatEditEvent
  | ChatTypingStartEvent
  | ChatTypingStopEvent;

// -----------------------------------------------------------------------
// React layer.

export type ConnectionId = string;

export type Other = {
  connectionId: ConnectionId;
  info: UserInfo;
  presence: Presence;
};

export type ConnectionStatus =
  | "initial"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected";

type Listener = (e: { event: RoomEvent }) => void;

type Ctx = {
  roomCode: string;
  status: ConnectionStatus;
  broadcast: (event: RoomEvent) => void;
  subscribe: (cb: Listener) => () => void;
};

const Context = createContext<Ctx | null>(null);

const EMPTY_PRESENCE: Presence = {
  name: null,
  avatar: null,
};

export function RoomProvider({
  id,
  initialPresence,
  userInfo,
  children,
}: {
  /** Room code (e.g. "BPWVJB"). Used as the channel topic suffix. */
  id: string;
  initialPresence: Presence;
  userInfo?: UserInfo;
  children: ReactNode;
}) {
  const supabase = useMemo(() => getBrowserSupabase(), []);
  // `initialPresence` and `userInfo` props are retained on the
  // public RoomProvider API for backwards compat (RoomShell still
  // passes them) but no longer wired anywhere — presence moved off
  // Supabase Realtime entirely. Reads-only as far as the channel
  // is concerned.
  void initialPresence;
  void userInfo;

  const [status, setStatus] = useState<ConnectionStatus>("initial");
  const channelRef = useRef<RealtimeChannel | null>(null);
  const listenersRef = useRef<Set<Listener>>(new Set());

  // Mount the channel once per room id. BROADCASTS ONLY: presence
  // moved off this channel after one too many "Client presence rate
  // limit exceeded" → phx_close kicks (free-tier presence caps at
  // ~1/sec/client, and the watch-party UI fan-out blew past it).
  // "Who's in the room right now" is now a REST poll against
  // /api/rooms/[code]/participants, fed by every viewer's heartbeat
  // upsert into the voters table. Broadcasts (chat:new, chat:react,
  // chat:edit, chat:delete, typing:start, typing:stop, score hints)
  // stay on this channel — their ceiling is 200/sec project-wide,
  // we run at ~3/sec at climax.
  useEffect(() => {
    if (!id) return;
    setStatus("connecting");

    const channel = supabase.channel(`room:${id}`, {
      config: {
        broadcast: { self: false, ack: false },
      },
    });

    channel
      .on("broadcast", { event: "msg" }, ({ payload }) => {
        const event = payload as RoomEvent;
        // Snapshot the set so a handler that calls back into
        // subscribe()/unsubscribe() doesn't mutate mid-iteration.
        for (const cb of Array.from(listenersRef.current)) {
          try {
            cb({ event });
          } catch (err) {
            if (process.env.NODE_ENV !== "production") {
              console.error("[realtime] listener threw", err);
            }
          }
        }
      })
      .subscribe((s) => {
        if (s === "SUBSCRIBED") {
          setStatus("connected");
        } else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT") {
          setStatus("reconnecting");
        } else if (s === "CLOSED") {
          setStatus("disconnected");
        }
      });

    channelRef.current = channel;

    return () => {
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [id, supabase]);

  const broadcast = useCallback((event: RoomEvent) => {
    const ch = channelRef.current;
    if (!ch) return;
    void ch.send({ type: "broadcast", event: "msg", payload: event });
  }, []);

  const subscribe = useCallback((cb: Listener) => {
    listenersRef.current.add(cb);
    return () => {
      listenersRef.current.delete(cb);
    };
  }, []);

  const value: Ctx = useMemo(
    () => ({
      roomCode: id,
      status,
      broadcast,
      subscribe,
    }),
    [id, status, broadcast, subscribe],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

function useCtx(): Ctx {
  const ctx = useContext(Context);
  if (!ctx) {
    throw new Error("Realtime hook used outside <RoomProvider>");
  }
  return ctx;
}

export function useBroadcastEvent(): (event: RoomEvent) => void {
  return useCtx().broadcast;
}

export function useEventListener(cb: Listener): void {
  const { subscribe } = useCtx();
  const cbRef = useRef(cb);
  cbRef.current = cb;
  useEffect(() => {
    return subscribe((e) => cbRef.current(e));
  }, [subscribe]);
}

export function useStatus(): ConnectionStatus {
  return useCtx().status;
}

export function useRoom(): {
  id: string;
  broadcastEvent: (event: RoomEvent) => void;
} {
  const { roomCode, broadcast } = useCtx();
  return { id: roomCode, broadcastEvent: broadcast };
}
