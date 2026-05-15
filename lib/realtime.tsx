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
  | ChatEditEvent;

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
  myKey: ConnectionId;
  myInfo: UserInfo;
  myPresence: Presence;
  others: Other[];
  status: ConnectionStatus;
  updateMyPresence: (patch: Partial<Presence>) => void;
  broadcast: (event: RoomEvent) => void;
  subscribe: (cb: Listener) => () => void;
};

const Context = createContext<Ctx | null>(null);

const EMPTY_PRESENCE: Presence = {
  name: null,
  avatar: null,
  emoji: null,
  hoveredCountry: null,
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
  const myKey = useMemo(
    () =>
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2),
    [],
  );
  const myInfo = useMemo<UserInfo>(
    () => userInfo ?? { name: "", color: "#ffffff" },
    // userInfo is read once at provider mount — same lifecycle as
    // Liveblocks' initialPresence.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [myPresence, setMyPresence] = useState<Presence>(initialPresence);
  const [others, setOthers] = useState<Other[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>("initial");
  const channelRef = useRef<RealtimeChannel | null>(null);
  const presenceRef = useRef<Presence>(initialPresence);
  const listenersRef = useRef<Set<Listener>>(new Set());

  // Mount the channel once per room id. Re-subscribes on hot reload
  // because supabase-js dedupes by topic + ref, not by component
  // instance — we cleanup explicitly.
  useEffect(() => {
    if (!id) return;
    setStatus("connecting");

    const channel = supabase.channel(`room:${id}`, {
      config: {
        presence: { key: myKey },
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
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState() as Record<
          string,
          Array<{ info?: UserInfo; presence?: Presence }>
        >;
        const next: Other[] = [];
        for (const [key, metas] of Object.entries(state)) {
          if (key === myKey) continue;
          const meta = metas[0];
          if (!meta) continue;
          next.push({
            connectionId: key,
            info: meta.info ?? { name: "", color: "#ffffff" },
            presence: { ...EMPTY_PRESENCE, ...(meta.presence ?? {}) },
          });
        }
        setOthers(next);
      })
      .subscribe(async (s) => {
        if (s === "SUBSCRIBED") {
          setStatus("connected");
          await channel.track({ info: myInfo, presence: presenceRef.current });
        } else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT") {
          setStatus("reconnecting");
        } else if (s === "CLOSED") {
          setStatus("disconnected");
        }
      });

    channelRef.current = channel;

    // Defensive re-track on tab return only. The earlier revision
    // also ran a 30s interval that kept re-pushing `channel.track`,
    // which was suspected of interacting badly with the supabase-js
    // reconnect cycle ("chat doesn't update without a refresh"
    // symptom). Visibility-return is cheap, narrowly scoped, and
    // covers the only common case the original interval was
    // designed for: a tab that was backgrounded came back and
    // needs to tell peers it's here.
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void channel.track({ info: myInfo, presence: presenceRef.current });
      }
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibility);
    }

    return () => {
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibility);
      }
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [id, myKey, supabase, myInfo]);

  const updateMyPresence = useCallback((patch: Partial<Presence>) => {
    const next = { ...presenceRef.current, ...patch };
    presenceRef.current = next;
    setMyPresence(next);
    const ch = channelRef.current;
    if (ch) {
      void ch.track({ info: myInfo, presence: next });
    }
  }, [myInfo]);

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
      myKey,
      myInfo,
      myPresence,
      others,
      status,
      updateMyPresence,
      broadcast,
      subscribe,
    }),
    [
      id,
      myKey,
      myInfo,
      myPresence,
      others,
      status,
      updateMyPresence,
      broadcast,
      subscribe,
    ],
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

export function useMyPresence(): [Presence, (patch: Partial<Presence>) => void] {
  const { myPresence, updateMyPresence } = useCtx();
  return [myPresence, updateMyPresence];
}

export function useUpdateMyPresence(): (patch: Partial<Presence>) => void {
  return useCtx().updateMyPresence;
}

export function useOthers(): Other[];
export function useOthers<T>(selector: (others: Other[]) => T): T;
export function useOthers<T>(selector?: (others: Other[]) => T): Other[] | T {
  const { others } = useCtx();
  return selector ? selector(others) : others;
}

export function useOthersConnectionIds(): ConnectionId[] {
  const { others } = useCtx();
  return useMemo(() => others.map((o) => o.connectionId), [others]);
}

export function useOther<T>(
  connectionId: ConnectionId,
  selector: (other: Other) => T,
): T | null {
  const { others } = useCtx();
  const found = others.find((o) => o.connectionId === connectionId);
  return found ? selector(found) : null;
}

export function useSelf(): { connectionId: ConnectionId; info: UserInfo; presence: Presence } {
  const { myKey, myInfo, myPresence } = useCtx();
  return { connectionId: myKey, info: myInfo, presence: myPresence };
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
