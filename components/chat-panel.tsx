"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Reply,
  Pencil,
  Smile,
  ImagePlus,
  Loader2,
  ChevronUp,
  ArrowDown,
  ImageDown,
} from "lucide-react";
import { toast } from "sonner";
import {
  useEventListener,
  useOthers,
  useStatus,
  useUpdateMyPresence,
  type ChatMessagePayload,
} from "@/lib/realtime";
import { useRoomLive } from "@/components/room-shell";
import { useIdentity } from "@/lib/use-identity";
import { bumpVibe } from "@/lib/use-vibe-tracker";
import { GifPicker } from "@/components/gif-picker";
import { ChatRow, type Message, type MessageKind } from "@/components/chat-row";
import { Lightbox } from "@/components/chat-lightbox";
import { prefetchProfile } from "@/components/profile-sheet";
import { t } from "@/lib/i18n";
import { useLang } from "@/lib/i18n-client";
import { haptic } from "@/lib/haptics";

// How many messages we keep in the DOM. The API already windows to the
// last ~50 per fetch; this is the cap once "load earlier" pages kick in.
// Base render cap for the natural-growth case (long-running room
// that never paginates). When the user explicitly hits "Load
// earlier" we expand this cap by the loaded batch size so that
// the next `runFetch` doesn't silently truncate the history the
// user just summoned. Tracked via the `loadedHistory` ref below.
const RENDER_CAP = 120;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const TYPING_OFF_MS = 3000;

// ---------------------------------------------------------------------
// Helpers

// Does `text` mention `name` (`@Name` followed by a word boundary)?
function mentionsName(text: string, name: string): boolean {
  const idx = text.toLowerCase().indexOf(`@${name.toLowerCase()}`);
  if (idx === -1) return false;
  const after = text[idx + 1 + name.length];
  return after === undefined || /[\s.,!?:;)"']/.test(after);
}

function dayKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

function dayLabel(iso: string, lang: "en" | "lt"): string {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  const k = dayKey(iso);
  if (k === dayKey(today.toISOString())) return t(lang, "chat_today");
  if (k === dayKey(yest.toISOString())) return t(lang, "chat_yesterday");
  return d.toLocaleDateString(lang === "lt" ? "lt-LT" : undefined, {
    day: "numeric",
    month: "short",
  });
}

// ---------------------------------------------------------------------

export function ChatPanel({ active = true }: { active?: boolean }) {
  const { code, nowPlayingCode } = useRoomLive();
  const lang = useLang();
  const others = useOthers();
  const updatePresence = useUpdateMyPresence();
  const realtimeStatus = useStatus();
  const { name, avatarId, sessionId } = useIdentity();
  const mySession = sessionId();

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [editBody, setEditBody] = useState("");
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [gifOpen, setGifOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  // An image the user picked but hasn't confirmed yet — shown as a
  // preview chip above the composer so they can eyeball it (and bail)
  // before it goes out.
  const [pendingImage, setPendingImage] = useState<{ file: File; url: string } | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [newCount, setNewCount] = useState(0);
  // Lightbox tracks BOTH the rendered URL and the underlying
  // message id. When the author deletes their own image while a
  // viewer has the lightbox open, the message disappears from the
  // list — we close the lightbox in the same tick instead of
  // leaving the (still-valid) Supabase URL hanging.
  const [lightbox, setLightbox] = useState<{ url: string; messageId: string | null } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  // The current visual viewport (the bit of the page that's actually
  const [viewport, setViewport] = useState<{ h: number; top: number } | null>(null);
  const [composerFocused, setComposerFocused] = useState(false);
  // True at the md+ breakpoint. On mobile the bottom dock CSS-hides
  // when the composer is focused (room-shell adds max-md:hidden) and
  // the chat panel consumes the full visual viewport so the composer
  // sits flush above the keyboard. On desktop the dock stays put, so
  // we always reserve its 4.75rem of space — composer never gets
  // covered. Using a media query instead of trying to sniff "is a
  // keyboard up" from the visual viewport delta — that heuristic was
  // misfiring on some mobile browsers and leaving a blank strip.
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  // The dock + header are CSS-hidden when both: composer is focused
  // AND we're on mobile. That's the only state where the chat panel
  // gets to consume the full viewport height.
  const dockHidden = composerFocused && !isDesktop;
  const dragDepth = useRef(0);

  const listRef = useRef<HTMLDivElement | null>(null);
  // The composer is a contentEditable <div> (an experiment — dodges the
  // iOS keyboard accessory bar that <textarea>/<input> always get).
  const taRef = useRef<HTMLInputElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const didInitialScroll = useRef(false);
  const atBottomRef = useRef(true);
  // Messages just prepended by "load earlier" — they must NOT count
  // toward the "N new messages" badge (they're history, not arrivals).
  const prependedRef = useRef(0);
  // How many rows the user has explicitly loaded via "earlier" so
  // far. `runFetch`'s render-cap slice grows by this many extra
  // rows; otherwise the next live event would yank the paginated
  // history out from under the reader.
  const loadedHistoryRef = useRef(0);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Build an optimistic Message from the current identity + reply state.
  const makeOptimistic = useCallback(
    (partial: Partial<Message> & Pick<Message, "kind">): Message => ({
      id: `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      sessionId: mySession,
      name: name || "Anon",
      avatarId,
      body: null,
      gifUrl: null,
      replyTo: replyTo?.id ?? null,
      meta: null,
      createdAt: new Date().toISOString(),
      reactions: {},
      pending: true,
      ...partial,
    }),
    [mySession, name, avatarId, replyTo],
  );

  // Known participant names (presence + me) for @-mention autocomplete
  // and highlighting. Deduped, alpha-sorted.
  const participantNames = useMemo(() => {
    const set = new Set<string>();
    if (name) set.add(name);
    for (const o of others) {
      const n = o.presence?.name;
      if (n) set.add(n);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [others, name]);

  // Who's typing right now (excluding me — useOthers already excludes self).
  const typingNames = useMemo(
    () =>
      others
        .filter((o) => o.presence?.typing && o.presence?.name)
        .map((o) => o.presence!.name as string),
    [others],
  );

  // Clear typing presence on unmount.
  useEffect(() => {
    return () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
      updatePresence({ typing: false });
    };
  }, [updatePresence]);

  // Warm the profile cache for recently active chat authors so taps
  // on an avatar bubble feel instant. Computed as a memoised key —
  // the underlying `messages` array changes on every reaction storm
  // tick, but the SET of recent author sessionIds only changes when
  // a new participant chimes in. Without the memo this effect would
  // schedule (and immediately tear down) 10 setTimeouts per chat
  // event; at climax that's hundreds of timer churns/min.
  const recentAuthorsKey = useMemo(() => {
    if (!mySession || messages.length === 0) return "";
    const seen: string[] = [];
    const haveSeen = new Set<string>();
    for (let i = messages.length - 1; i >= 0 && seen.length < 10; i--) {
      const sid = messages[i].sessionId;
      if (!sid || sid === mySession || sid === "system" || sid === "commentator") continue;
      if (haveSeen.has(sid)) continue;
      haveSeen.add(sid);
      seen.push(sid);
    }
    return seen.join("|");
  }, [messages, mySession]);

  useEffect(() => {
    if (!code || !mySession || !recentAuthorsKey) return;
    const recentAuthors = recentAuthorsKey.split("|");
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    recentAuthors.forEach((sid, idx) => {
      const t = setTimeout(() => {
        if (cancelled) return;
        prefetchProfile(code, sid, mySession);
      }, idx * 80);
      timers.push(t);
    });
    return () => {
      cancelled = true;
      for (const t of timers) clearTimeout(t);
    };
  }, [code, mySession, recentAuthorsKey]);

  // ----- fetch -----
  const fetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runFetch = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/rooms/${code}/chat?session=${encodeURIComponent(mySession)}&limit=50`,
        { cache: "no-store" },
      );
      if (!res.ok) return;
      const data = (await res.json()) as { messages: Message[] };
      const fresh = data.messages;
      setHasMore(fresh.length >= 50);
      setMessages((prev) => {
        const freshIds = new Set(fresh.map((m) => m.id));
        const olderKept = prev.filter(
          (m) =>
            !freshIds.has(m.id) &&
            !m.pending &&
            new Date(m.createdAt).getTime() <
              new Date(fresh[0]?.createdAt ?? 0).getTime(),
        );
        const stillPending = prev.filter((m) => m.pending && !freshIds.has(m.id));
        const cap = RENDER_CAP + loadedHistoryRef.current;
        return [...olderKept, ...fresh, ...stillPending].slice(-cap);
      });
    } finally {
      setLoading(false);
    }
  }, [code, mySession]);

  // Events get a trailing debounce (a burst of chat:new collapses to one
  // round-trip); the initial load runs immediately.
  const fetchMessages = useCallback(
    (immediate = false) => {
      if (immediate) {
        if (fetchTimer.current) {
          clearTimeout(fetchTimer.current);
          fetchTimer.current = null;
        }
        void runFetch();
        return;
      }
      if (fetchTimer.current) return;
      fetchTimer.current = setTimeout(() => {
        fetchTimer.current = null;
        void runFetch();
      }, 180);
    },
    [runFetch],
  );

  // Reaction-storm refetch: every chat:react used to fire a full
  // 50-message GET. Leading-edge throttle: the first broadcast in
  // a cooldown window fires the refetch immediately (so poll bars
  // and emoji tallies settle within one round-trip, not after a
  // trailing-edge delay), and subsequent broadcasts in the same
  // ~600ms window collapse into a single trailing refresh. The
  // trailing fire only happens if more broadcasts arrived during
  // the cooldown, so a single tap doesn't double-fetch.
  const reactTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reactPending = useRef(false);
  const scheduleReactRefetch = useCallback(() => {
    if (reactTimer.current) {
      // Already in cooldown — note that more events arrived so the
      // trailing tick fires once when the window closes.
      reactPending.current = true;
      return;
    }
    void runFetch();
    reactTimer.current = setTimeout(() => {
      reactTimer.current = null;
      if (reactPending.current) {
        reactPending.current = false;
        void runFetch();
      }
    }, 600);
  }, [runFetch]);

  // Reconnect catch-up. Supabase broadcasts are advisory; if our
  // websocket flips to reconnecting (CHANNEL_ERROR / TIMED_OUT)
  // and recovers, anything that landed in the gap is lost forever
  // unless we explicitly refetch. Track the previous status in a
  // ref and fire a full window pull on the reconnecting → connected
  // edge. The initial connecting → connected transition is gated by
  // `wasReconnecting` so the mount-time fetch doesn't double-fire.
  const wasReconnecting = useRef(false);
  useEffect(() => {
    if (realtimeStatus === "reconnecting" || realtimeStatus === "disconnected") {
      wasReconnecting.current = true;
      return;
    }
    if (realtimeStatus === "connected" && wasReconnecting.current) {
      wasReconnecting.current = false;
      void runFetch();
    }
  }, [realtimeStatus, runFetch]);

  // Mount: paint the last-seen messages from sessionStorage instantly so
  // switching to the Chat tab isn't a blank flash, then refresh in the
  // background.
  useEffect(() => {
    try {
      const cached = sessionStorage.getItem(`uzk_chat_cache_${code}`);
      if (cached) {
        const arr = JSON.parse(cached) as Message[];
        if (Array.isArray(arr) && arr.length) {
          setMessages(arr);
          setLoading(false);
          // Seed `lastCount` to the cache size so the very next
          // runFetch — which arrives with the full window from the
          // server — doesn't read as "the list just grew by 50"
          // and trigger a spurious smooth-scroll-to-bottom right
          // when the tab paints. Without this stamp the chat
          // randomly jumps a few pixels on first paint.
          lastCount.current = arr.length;
        }
      }
    } catch {
      /* private mode / corrupt */
    }
    // Reset pagination growth + the "rows prepended on the latest
    // loadEarlier" counter on room change. Without the prepend
    // reset, the first scroll-locking layout effect on the new
    // room could mis-attribute its initial growth as paginated
    // history and skip the bottom-of-room auto-scroll.
    loadedHistoryRef.current = 0;
    prependedRef.current = 0;
    fetchMessages(true);
    return () => {
      if (fetchTimer.current) clearTimeout(fetchTimer.current);
      // The reaction-throttle timer needs to be torn down too —
      // otherwise navigating away mid-storm leaves a pending
      // refetch that runs setState on an unmounted component.
      if (reactTimer.current) clearTimeout(reactTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // Auto-close the lightbox if its underlying message leaves the
  // visible window (author deleted, scrolled out of RENDER_CAP).
  // The Supabase URL would still load otherwise, leaving a stale
  // image hanging over an in-flight conversation.
  useEffect(() => {
    if (!lightbox?.messageId) return;
    if (!messages.some((m) => m.id === lightbox.messageId)) {
      setLightbox(null);
    }
  }, [messages, lightbox]);

  // Keep the cache warm for the next tab switch. Debounced 500ms so
  // a reaction storm doesn't fire stringify+setItem on every tick;
  // the most-recent payload always wins when the timer fires.
  const cacheTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (messages.length === 0) return;
    if (cacheTimer.current) clearTimeout(cacheTimer.current);
    cacheTimer.current = setTimeout(() => {
      cacheTimer.current = null;
      try {
        sessionStorage.setItem(
          `uzk_chat_cache_${code}`,
          JSON.stringify(messages.filter((m) => !m.pending).slice(-50)),
        );
      } catch {
        /* ignore */
      }
    }, 500);
    return () => {
      if (cacheTimer.current) clearTimeout(cacheTimer.current);
    };
  }, [messages, code]);

  // Mirror the visual viewport — the panel is sized to *exactly* this
  // (top = offsetTop, height = height), so its bottom edge is the bottom
  // of what's visible = the top of the on-screen keyboard. No "layout
  // viewport minus keyboard" arithmetic, no iOS innerHeight quirks, no
  // dead gap behind the keyboard or the form-accessory bar. The
  // visualViewport resize event fires continuously during the keyboard
  // slide, so it tracks smoothly.
  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!vv) return;
    const sync = () => setViewport({ h: vv.height, top: Math.max(0, vv.offsetTop) });
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    sync();
    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
    };
  }, []);

  const loadEarlier = async () => {
    if (loadingMore || messages.length === 0) return;
    setLoadingMore(true);
    const el = listRef.current;
    const prevH = el?.scrollHeight ?? 0;
    try {
      const oldest = messages.find((m) => !m.pending);
      if (!oldest) return;
      // Tuple cursor: pass both the timestamp AND the id so two
      // messages sharing an exact millisecond (system + user
      // landing in the same transaction) page cleanly. Older
      // backends without `beforeId` support just ignore the
      // second param.
      const res = await fetch(
        `/api/rooms/${code}/chat?before=${encodeURIComponent(oldest.createdAt)}&beforeId=${encodeURIComponent(oldest.id)}&limit=50`,
        { cache: "no-store" },
      );
      if (!res.ok) return;
      const data = (await res.json()) as { messages: Message[] };
      setHasMore(data.messages.length >= 50);
      if (data.messages.length === 0) return;
      setMessages((prev) => {
        const have = new Set(prev.map((m) => m.id));
        const add = data.messages.filter((m) => !have.has(m.id));
        prependedRef.current += add.length;
        loadedHistoryRef.current += add.length;
        return [...add, ...prev];
      });
      requestAnimationFrame(() => {
        if (el) el.scrollTop = el.scrollHeight - prevH + el.scrollTop;
      });
    } finally {
      setLoadingMore(false);
    }
  };

  // ----- scroll position tracking -----
  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    atBottomRef.current = near;
    setAtBottom(near);
    if (near) setNewCount(0);
    // Reached the top → pull in the previous page.
    if (hasMore && !loadingMore && el.scrollTop < 80) void loadEarlier();
  };

  const scrollToBottom = (smooth = true) => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    atBottomRef.current = true;
    setAtBottom(true);
    setNewCount(0);
  };

  // ----- "seen" beacon: when I'm parked at the bottom and the tab is
  // visible, broadcast the newest message's timestamp so others can show
  // "seen by N". -----
  const newestIso = messages.length ? messages[messages.length - 1].createdAt : null;
  useEffect(() => {
    if (!newestIso || !active) return;
    if (atBottom && (typeof document === "undefined" || !document.hidden)) {
      updatePresence({ seenAt: newestIso });
    }
  }, [newestIso, atBottom, active, updatePresence]);

  // Tab-bar unread badge clear — only while the chat tab is actually
  // showing (the panel stays mounted on other tabs). Deps are
  // intentionally `[code, active]` and NOT `messages.length`: under
  // hundreds of messages/min during the climax, this effect would
  // fire a localStorage write + window event for every new row.
  // Once-on-tab-activation is the correct behaviour — the
  // `chat:new` event listener below already sets `unread = 0` while
  // active, so badging stays accurate.
  useEffect(() => {
    if (!active) return;
    try {
      localStorage.setItem(`uzk_chat_seen_${code}`, new Date().toISOString());
      window.dispatchEvent(new Event("uzk:chat-seen"));
    } catch {
      /* private mode */
    }
  }, [code, active]);

  useEventListener(({ event }) => {
    const ev = event as {
      type?: string;
      id?: string;
      message?: ChatMessagePayload;
      // Delta fields on chat:react — present on the current server
      // so listeners can patch reactions in place. Falls back to the
      // throttled refetch when fields are missing (old server).
      emoji?: string;
      added?: boolean;
      sessionId?: string;
      name?: string;
    };
    if (ev.type === "chat:delete") {
      if (ev.id) setMessages((prev) => prev.filter((m) => m.id !== ev.id));
      return;
    }
    if (ev.type === "chat:new") {
      // The server embeds the full row in the broadcast, so we can
      // append in-place without a follow-up GET. Older servers without
      // the payload fall back to the refetch.
      if (ev.message) {
        const m = ev.message;
        setMessages((prev) => {
          // 1) Already in the list (echo for someone else's POST that
          //    we GET-loaded, or duplicate broadcast) — skip.
          if (prev.some((x) => x.id === m.id)) return prev;
          // 2) This is the echo of OUR own POST: our optimistic row is
          //    still sitting in `prev` with a `tmp-…` id. Replace it
          //    in-place so the bubble doesn't double-render during the
          //    window between broadcast arrival and POST-response.
          if (m.sessionId === mySession) {
            // For images/gifs the optimistic row holds a `blob:`
            // URL while the broadcast carries the hosted URL —
            // matching on `gifUrl ===` always fails, so we use a
            // temporal match (same kind, posted within ~1.5s) for
            // media kinds. The earlier 5s window was loose enough
            // that a second image POSTed in quick succession could
            // collide with the finalised first one. Text matches on
            // the trimmed body AND temporal window so two identical
            // texts in a row don't mis-pair. `pending=true` is the
            // hard gate; the temporal window is the tiebreaker.
            const arrived = Date.parse(m.createdAt);
            const TEMPORAL_MATCH_MS = 1_500;
            // Defensive: text-kind dedup REQUIRES both sides to
            // have a real body. Two null-body rows of any
            // unrelated origin (impossible today, but cheap to
            // guard) wouldn't pair on `null === null`.
            const sameBody = (a: string | null, b: string | null) =>
              a != null && b != null && a.trim() === b.trim();
            const tmpIdx = prev.findIndex(
              (x) =>
                x.pending &&
                x.id.startsWith("tmp-") &&
                x.sessionId === mySession &&
                x.kind === m.kind &&
                Math.abs(arrived - Date.parse(x.createdAt)) < TEMPORAL_MATCH_MS &&
                (m.kind !== "text" || sameBody(x.body, m.body)),
            );
            if (tmpIdx >= 0) {
              const next = prev.slice();
              next[tmpIdx] = {
                id: m.id,
                sessionId: m.sessionId,
                name: m.name,
                avatarId: m.avatarId,
                kind: m.kind as MessageKind,
                body: m.body,
                gifUrl: m.gifUrl,
                replyTo: m.replyTo,
                meta: (m.meta ?? null) as Record<string, unknown> | null,
                createdAt: m.createdAt,
                reactions: {},
              };
              return next;
            }
          }
          const appended: Message = {
            id: m.id,
            sessionId: m.sessionId,
            name: m.name,
            avatarId: m.avatarId,
            kind: m.kind as MessageKind,
            body: m.body,
            gifUrl: m.gifUrl,
            replyTo: m.replyTo,
            meta: (m.meta ?? null) as Record<string, unknown> | null,
            createdAt: m.createdAt,
            reactions: {},
          };
          // Same cap-growth rule as runFetch: the chat:new tail
          // append shouldn't yank the user's paginated history.
          const cap = RENDER_CAP + loadedHistoryRef.current;
          return [...prev, appended].slice(-cap);
        });
        return;
      }
      // No payload: fall back to a refetch. (Stale-broadcast safety:
      // skip if we already know this id.)
      if (ev.id && byId.has(ev.id)) return;
      fetchMessages();
      return;
    }
    // chat:react: prefer the in-place delta patch when the server
    // included `{emoji, added, sessionId, name}` in the payload —
    // skips the 50-row GET entirely. At climax 30 viewers reacting
    // was previously ~3000 GETs/min; with the delta path it's
    // essentially zero. The throttled refetch still runs as a
    // safety net (handles missed broadcasts / older payload shape).
    if (ev.type === "chat:react" && ev.id) {
      const hasDelta =
        typeof ev.emoji === "string" &&
        typeof ev.added === "boolean" &&
        typeof ev.sessionId === "string" &&
        typeof ev.name === "string";
      if (hasDelta) {
        const id = ev.id;
        const emoji = ev.emoji as string;
        const added = ev.added as boolean;
        const reactorSession = ev.sessionId as string;
        const reactorName = ev.name as string;
        const isMine = reactorSession === mySession;
        setMessages((prev) => {
          const idx = prev.findIndex((m) => m.id === id);
          if (idx < 0) return prev;
          const m = prev[idx];
          const nextReactions = { ...m.reactions };
          const slot = nextReactions[emoji]
            ? {
                count: nextReactions[emoji].count,
                names: nextReactions[emoji].names.slice(),
                mine: nextReactions[emoji].mine,
              }
            : { count: 0, names: [] as string[], mine: false };
          if (added) {
            slot.count += 1;
            slot.names.push(reactorName);
            if (isMine) slot.mine = true;
          } else {
            slot.count = Math.max(0, slot.count - 1);
            const ni = slot.names.indexOf(reactorName);
            if (ni >= 0) slot.names.splice(ni, 1);
            if (isMine) slot.mine = false;
          }
          if (slot.count <= 0) {
            delete nextReactions[emoji];
          } else {
            nextReactions[emoji] = slot;
          }
          const next = prev.slice();
          next[idx] = { ...m, reactions: nextReactions };
          return next;
        });
        return;
      }
      // No delta (older server) — fall back to the throttled refetch.
      scheduleReactRefetch();
    }
    // chat:edit carries the full updated payload so we can patch
    // the row in place — no follow-up GET, no waiting for the
    // reaction throttle to flush.
    if (ev.type === "chat:edit" && ev.message) {
      const m = ev.message;
      setMessages((prev) =>
        prev.map((x) =>
          x.id === m.id
            ? {
                ...x,
                body: m.body,
                meta: (m.meta ?? null) as Record<string, unknown> | null,
              }
            : x,
        ),
      );
    }
  });

  // First render: jump to the bottom (no animation). After that:
  // - if the user is at the bottom, follow new messages;
  // - otherwise bump the "N new messages" counter.
  const lastCount = useRef(0);
  useLayoutEffect(() => {
    if (loading || !listRef.current) return;
    const el = listRef.current;
    if (!didInitialScroll.current) {
      el.scrollTop = el.scrollHeight;
      didInitialScroll.current = true;
      lastCount.current = messages.length;
      return;
    }
    // Discount anything "load earlier" prepended — only true tail
    // arrivals advance the badge.
    const grew = messages.length - lastCount.current - prependedRef.current;
    prependedRef.current = 0;
    lastCount.current = messages.length;
    if (grew <= 0) return;
    if (atBottomRef.current) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    } else {
      setNewCount((n) => n + grew);
    }
  }, [messages, loading]);

  // Re-entering the chat tab: the list was display:none, so any messages
  // that arrived while hidden ran their "scroll to bottom" against a
  // zero-height element and clamped scrollTop to 0. If we were parked at
  // the bottom, snap back to the newest message. (If the user had
  // scrolled up to read history, leave their position alone.)
  useLayoutEffect(() => {
    if (!active) return;
    const el = listRef.current;
    if (!el || !atBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
    setNewCount(0);
  }, [active]);

  // Window-level paste: if the chat tab is in front and the user pastes
  // an image from anywhere (the composer doesn't need to be focused),
  // queue it. This catches the "Ctrl+V on the screenshot I just took"
  // flow that the composer-only handler would miss on desktop.
  useEffect(() => {
    if (!active) return;
    const onPasteGlobal = (e: ClipboardEvent) => {
      // Don't fight an input element that's already handling its own
      // paste — the contentEditable composer's own onPaste runs first
      // and stops propagation if it caught an image.
      const target = e.target as Element | null;
      if (target && target.closest("input, textarea, [contenteditable=true]")) {
        return;
      }
      if (!e.clipboardData) return;
      const file = Array.from(e.clipboardData.items)
        .find((i) => i.type.startsWith("image/"))
        ?.getAsFile();
      if (file) {
        e.preventDefault();
        queueImage(file);
      }
    };
    window.addEventListener("paste", onPasteGlobal);
    return () => window.removeEventListener("paste", onPasteGlobal);
    // queueImage is stable enough — it references state setters only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // A GIF / image finished loading and pushed the list taller — if we
  // were parked at the bottom (e.g. you just sent it), stay there.
  useEffect(() => {
    const stick = () => {
      const el = listRef.current;
      if (el && atBottomRef.current) el.scrollTop = el.scrollHeight;
    };
    window.addEventListener("uzk:chat-media-loaded", stick);
    return () => window.removeEventListener("uzk:chat-media-loaded", stick);
  }, []);

  // iOS keyboard fix: when the visualViewport shrinks (keyboard
  // animates open) the panel's height drops to match — but the list
  // inside keeps its old scrollTop, so the newest message slides
  // *up* out of view by exactly the keyboard's first paint height.
  // The user is "naturally at the bottom" of the chat and focusing
  // the composer makes the thread jump up a few px. Pin scrollTop
  // back to scrollHeight whenever the viewport changes AND the
  // user was parked at the bottom.
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (!atBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [viewport]);

  // Swipe / tap to reply: anchor the replied-to message in the middle
  // so the list doesn't jump somewhere random. Run once now, and again
  // after the keyboard / reply-chip layout settles — without the second
  // pass the message would land off-screen on iOS roughly half the time.
  useEffect(() => {
    if (!replyTo) return;
    const id = replyTo.id;
    const scroll = () =>
      listRef.current
        ?.querySelector<HTMLElement>(`[data-msg-id="${id}"]`)
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
    const raf = requestAnimationFrame(scroll);
    const settle = window.setTimeout(scroll, 280);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(settle);
    };
    // PERF: deps were [replyTo, composerFocused, viewport] which
    // fired the smooth-scroll-into-view on every keyboard tick + on
    // every focus flip — the list kept "fighting back to centre" as
    // the iOS keyboard animated open. The intent is "scroll once
    // when a reply target is selected", so the only dep we need is
    // the reply target's id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replyTo?.id]);

  // ----- composer / typing -----
  const onComposerChange = (v: string) => {
    setBody(v.slice(0, 2000));
    updatePresence({ typing: v.trim().length > 0 });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(
      () => updatePresence({ typing: false }),
      TYPING_OFF_MS,
    );
  };
  const clearTyping = () => {
    if (typingTimer.current) clearTimeout(typingTimer.current);
    updatePresence({ typing: false });
  };

  const insertMention = (name: string) => {
    setBody((b) => b.replace(/@[^\s@]*$/, `@${name} `));
    taRef.current?.focus();
  };

  const senderName = name || "Anon";

  const send = async () => {
    const text = body.trim();
    if (!text) return;
    haptic(6);
    const reply = replyTo?.id ?? null;
    const mentions = participantNames.filter((n) => mentionsName(text, n));
    const optimistic = makeOptimistic({ kind: "text", body: text });
    setMessages((prev) => [...prev, optimistic]);
    setBody("");
    setReplyTo(null);
    clearTyping();
    requestAnimationFrame(() => scrollToBottom(false));

    try {
      const res = await fetch(`/api/rooms/${code}/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ session: mySession, name: senderName, avatarId, body: text, replyTo: reply, mentions }),
      });
      if (!res.ok) {
        // Pull the optimistic message back and restore the composer
        // text + reply target so the user can retry. The 429 case
        // keeps its toast — it's actionable info the user can't
        // infer from the composer state. Generic send failures stay
        // silent: the text reappearing in the composer IS the signal.
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
        setBody(text);
        setReplyTo(replyTo);
        if (res.status === 429) toast.error(t(lang, "chat_slow_down"));
        return;
      }
      const data = (await res.json()) as { id?: string };
      if (data.id) {
        // The broadcast handler may have already swapped the optimistic
        // row for the real one. In that case the optimistic id is gone
        // and the real id is already present — drop the optimistic to
        // be safe, then no-op if it's already been swapped.
        setMessages((prev) => {
          const hasReal = prev.some((m) => m.id === data.id);
          if (hasReal) return prev.filter((m) => m.id !== optimistic.id);
          return prev.map((m) =>
            m.id === optimistic.id ? { ...m, id: data.id!, pending: false } : m,
          );
        });
      }
    } catch {
      // Network blip — pull the optimistic row back and restore the
      // composer; the text reappearing is the signal.
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setBody(text);
    }
  };

  const sendGif = async (gifUrl: string) => {
    const reply = replyTo?.id ?? null;
    setReplyTo(null);
    requestAnimationFrame(() => scrollToBottom(false));
    // GIFs were previously fire-and-forget: a 429 / network blip
    // silently swallowed the send. Wire the failure case to a
    // toast so the user knows to retry. No optimistic row here —
    // the broadcast echo carries the rendered GIF in well under a
    // second, and an optimistic preview from the third-party GIF
    // URL would just double-render until the echo replaces it.
    try {
      const res = await fetch(`/api/rooms/${code}/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ session: mySession, name: senderName, avatarId, kind: "gif", gifUrl, replyTo: reply }),
      });
      if (!res.ok) {
        const { error } = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(error ?? "Couldn't send the GIF.");
      }
    } catch {
      toast.error("Couldn't send the GIF (network).");
    }
  };

  const sendImage = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error(t(lang, "chat_image_too_big"));
      return;
    }
    const reply = replyTo?.id ?? null;
    const localUrl = URL.createObjectURL(file);
    const optimistic = makeOptimistic({ kind: "image", gifUrl: localUrl });
    setMessages((prev) => [...prev, optimistic]);
    setReplyTo(null);
    setUploading(true);
    requestAnimationFrame(() => scrollToBottom(false));
    try {
      const form = new FormData();
      form.append("file", file);
      const up = await fetch(`/api/rooms/${code}/chat/upload`, { method: "POST", body: form });
      if (!up.ok) {
        const { error } = (await up.json().catch(() => ({}))) as { error?: string };
        throw new Error(error ?? t(lang, "chat_image_failed"));
      }
      const { url } = (await up.json()) as { url: string };
      const res = await fetch(`/api/rooms/${code}/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ session: mySession, name: senderName, avatarId, kind: "image", gifUrl: url, replyTo: reply }),
      });
      const data = (await res.json().catch(() => ({}))) as { id?: string };
      const realId = data.id ?? optimistic.id;
      // Keep showing the local blob preview; just stamp the real id so
      // the chat:new echo dedupes against it. Only swap to the hosted
      // URL once the browser has it cached — no "blank then appear" flash.
      // If the broadcast handler already swapped, drop the optimistic.
      setMessages((prev) => {
        const hasReal = prev.some((m) => m.id === realId && m.id !== optimistic.id);
        if (hasReal) return prev.filter((m) => m.id !== optimistic.id);
        return prev.map((m) =>
          m.id === optimistic.id ? { ...m, id: realId, pending: false } : m,
        );
      });
      const preload = new Image();
      const finishSwap = () => {
        setMessages((prev) =>
          prev.map((m) => (m.id === realId && m.gifUrl === localUrl ? { ...m, gifUrl: url } : m)),
        );
        URL.revokeObjectURL(localUrl);
      };
      preload.onload = finishSwap;
      preload.onerror = finishSwap;
      preload.src = url;
    } catch (err) {
      // Upload bounced — the optimistic image vanishes (signal
      // enough). Surface a toast only for the size-cap message
      // since that's actionable.
      const msg = (err as Error).message;
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      if (msg === t(lang, "chat_image_too_big")) toast.error(msg);
      URL.revokeObjectURL(localUrl);
    } finally {
      setUploading(false);
    }
  };

  // Stage an image for preview-then-send (validates first so we never
  // show a chip for something that'd bounce anyway).
  const queueImage = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error(t(lang, "chat_image_too_big"));
      return;
    }
    setPendingImage((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return { file, url: URL.createObjectURL(file) };
    });
  };
  const cancelPendingImage = () => {
    setPendingImage((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
  };
  const confirmPendingImage = () => {
    if (!pendingImage) return;
    const { file, url } = pendingImage;
    setPendingImage(null);
    URL.revokeObjectURL(url); // sendImage makes its own preview URL
    void sendImage(file);
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const item = Array.from(e.clipboardData.items).find((i) =>
      i.type.startsWith("image/"),
    );
    const file = item?.getAsFile();
    if (file) {
      e.preventDefault();
      queueImage(file);
    }
  };

  const react = async (msgId: string, emoji: string) => {
    setMenuFor(null);
    let added = false;
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== msgId) return m;
        const r = { ...m.reactions };
        const slot = r[emoji] ?? { count: 0, names: [], mine: false };
        if (slot.mine) {
          const next = {
            count: Math.max(0, slot.count - 1),
            names: slot.names.filter((n) => n !== senderName),
            mine: false,
          };
          if (next.count === 0) delete r[emoji];
          else r[emoji] = next;
        } else {
          r[emoji] = {
            count: slot.count + 1,
            names: [...slot.names, senderName],
            mine: true,
          };
          added = true;
        }
        return { ...m, reactions: r };
      }),
    );
    // Adding a reaction is engagement; removing one isn't (it's an
    // un-do, often a mistap). Only the add path bumps the mood ring.
    if (added) bumpVibe("reactionSent");
    fetch(`/api/rooms/${code}/chat/${msgId}/react`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ session: mySession, name: senderName, emoji }),
    }).catch(() => fetchMessages());
  };

  const startEdit = (m: Message) => {
    setMenuFor(null);
    setEditing(m);
    setEditBody(m.body ?? "");
  };

  const submitEdit = async () => {
    if (!editing) return;
    const text = editBody.trim();
    if (!text || text === editing.body) {
      setEditing(null);
      return;
    }
    const session = mySession;
    setMessages((prev) =>
      prev.map((m) =>
        m.id === editing.id
          ? { ...m, body: text, meta: { ...(m.meta ?? {}), edited: true } }
          : m,
      ),
    );
    setEditing(null);
    const res = await fetch(`/api/rooms/${code}/chat/${editing.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ session, body: text }),
    });
    if (!res.ok) {
      // Roll back to whatever the server has — the optimistic edit
      // didn't land. No toast: the message snapping back is the
      // signal.
      fetchMessages();
    }
  };

  const remove = async (m: Message) => {
    setMenuFor(null);
    const session = mySession;
    setMessages((prev) => prev.filter((x) => x.id !== m.id));
    if (m.pending) return;
    const res = await fetch(
      `/api/rooms/${code}/chat/${m.id}?session=${encodeURIComponent(session)}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      // Server refused — re-pull and re-render so the message reappears.
      fetchMessages();
    }
  };

  const copyBody = (m: Message) => {
    setMenuFor(null);
    const text = m.body ?? "";
    if (!text) return;
    navigator.clipboard.writeText(text).catch(() => {});
  };

  const byId = useMemo(() => {
    const m = new Map<string, Message>();
    for (const x of messages) m.set(x.id, x);
    return m;
  }, [messages]);

  const mentionQuery = useMemo(() => {
    const m = /@([^\s@]*)$/.exec(body);
    return m ? m[1].toLowerCase() : null;
  }, [body]);
  const mentionMatches = useMemo(() => {
    if (mentionQuery === null) return [];
    return participantNames
      .filter((n) => n.toLowerCase().includes(mentionQuery))
      .slice(0, 6);
  }, [mentionQuery, participantNames]);

  // "Seen by N": count others whose seenAt covers my latest message.
  const lastOwnIso = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.sessionId === mySession && (m.kind === "text" || m.kind === "gif" || m.kind === "image")) {
        return { iso: m.createdAt, id: m.id };
      }
    }
    return null;
  }, [messages]);
  const seenByCount = useMemo(() => {
    if (!lastOwnIso) return 0;
    const t0 = new Date(lastOwnIso.iso).getTime();
    let n = 0;
    for (const o of others) {
      const s = o.presence?.seenAt;
      if (s && new Date(s).getTime() >= t0) n++;
    }
    return n;
  }, [lastOwnIso, others]);

  return (
    // Sized to the visual viewport: `top` = its offset, `height` = its
    // height (minus the dock unless the keyboard's up). So the panel's
    // bottom edge is exactly the top of the keyboard — composer flush, no
    // gap. `pt-…` clears the fixed header — but when the composer's
    // focused the header is hidden (see RoomBody), so don't reserve its
    // space (otherwise there's an empty strip up top). Hidden (kept
    // mounted, scroll + state intact) when off the chat tab.
    <main
      className={`fixed inset-x-0 z-10 flex justify-center px-3 sm:px-4 ${
        dockHidden
          ? "pt-[env(safe-area-inset-top)]"
          : "pt-[calc(env(safe-area-inset-top)+3.5rem)]"
      }`}
      style={{
        top: viewport?.top ?? 0,
        // dockHidden = mobile + composer focused. In that one state the
        // dock + header are gone, so the chat panel takes the full
        // visual viewport (which on mobile is already shrunk by the
        // keyboard — composer ends flush above the keyboard, no gap).
        // Otherwise reserve the 4.75rem of dock space so the bottom
        // tab bar never overlaps the composer.
        height: viewport
          ? dockHidden
            ? viewport.h
            : `calc(${viewport.h}px - env(safe-area-inset-bottom) - 4.75rem)`
          : "calc(100dvh - env(safe-area-inset-bottom) - 4.75rem)",
        ...(active ? null : { display: "none" }),
      }}
      onDragEnter={(e) => {
        if (!Array.from(e.dataTransfer.types).includes("Files")) return;
        e.preventDefault();
        dragDepth.current += 1;
        setDragOver(true);
      }}
      onDragOver={(e) => {
        if (Array.from(e.dataTransfer.types).includes("Files")) e.preventDefault();
      }}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        dragDepth.current = 0;
        setDragOver(false);
        const f = Array.from(e.dataTransfer.files).find((x) => x.type.startsWith("image/"));
        if (f) queueImage(f);
      }}
    >
      <div className="relative flex flex-col w-full max-w-3xl min-h-0">
        <AnimatePresence>
          {dragOver && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="absolute inset-1 z-40 grid place-items-center rounded-2xl
                         bg-dark-blue-900/75 backdrop-blur-sm ring-2 ring-flamingo/50 pointer-events-none"
            >
              <span className="flex flex-col items-center gap-2 text-white/85">
                <ImageDown className="h-8 w-8" />
                <span className="text-sm font-display">{t(lang, "chat_drop_image")}</span>
              </span>
            </motion.div>
          )}
        </AnimatePresence>
        <div
          ref={listRef}
          onScroll={onScroll}
          // We deliberately don't dismiss the keyboard on touch-move:
          // every modern chat lets you keep typing while scrolling the
          // history. Tap the bubble or the composer Done key to close.
          className="flex-1 min-h-0 overflow-y-auto py-4 flex flex-col gap-3 fade-scroll-y"
          onClick={() => menuFor && setMenuFor(null)}
        >
          {loading ? (
            <ul className="flex flex-col gap-3">
              {[0, 1, 2].map((i) => (
                <li key={i} className="h-12 rounded-2xl bg-white/[0.04] skeleton" />
              ))}
            </ul>
          ) : messages.length === 0 ? (
            <div className="flex-1 grid place-items-center text-center text-white/45 gap-2">
              <Smile className="h-6 w-6 text-dark-blue-300" />
              <p className="text-sm">{t(lang, "chat_empty")}</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {hasMore && (
                <li className="flex justify-center">
                  <button
                    type="button"
                    onClick={loadEarlier}
                    disabled={loadingMore}
                    className="flex items-center gap-1.5 text-xs text-white/55 hover:text-white/85
                               rounded-full px-3 py-1.5 glass-surface transition
                               disabled:opacity-50"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                    {loadingMore ? t(lang, "loading") : t(lang, "chat_load_earlier")}
                  </button>
                </li>
              )}
              {messages.map((m, idx) => {
                const prev = messages[idx - 1] ?? null;
                const newDay = !prev || dayKey(prev.createdAt) !== dayKey(m.createdAt);
                const sameAuthor =
                  !newDay &&
                  !!prev &&
                  prev.sessionId === m.sessionId &&
                  prev.kind === "text" &&
                  m.kind === "text";
                return (
                  // Fragment instead of `<div className="contents">`:
                  // a div between <ul> and its <li> children is
                  // invalid HTML and breaks the accessibility tree
                  // (display:contents helps painting but not parsing).
                  <Fragment key={m.id}>
                    {newDay && (
                      <li className="flex justify-center my-1">
                        <span className="text-[11px] text-white/40 px-3 py-1 rounded-full bg-white/[0.04]">
                          {dayLabel(m.createdAt, lang)}
                        </span>
                      </li>
                    )}
                    <ChatRow
                      message={m}
                      mine={m.sessionId === mySession}
                      parent={m.replyTo ? byId.get(m.replyTo) ?? null : null}
                      showHeader={!sameAuthor}
                      menuOpen={menuFor === m.id}
                      participantNames={participantNames}
                      seenBy={lastOwnIso?.id === m.id ? seenByCount : 0}
                      onOpenMenu={() => setMenuFor(m.id)}
                      onCloseMenu={() => setMenuFor(null)}
                      onReact={(emoji) => react(m.id, emoji)}
                      onReply={() => {
                        setReplyTo(m);
                        setMenuFor(null);
                        // Jump straight into the composer — synchronous so
                        // iOS counts it as part of the touch gesture.
                        taRef.current?.focus();
                      }}
                      onEdit={() => startEdit(m)}
                      onCopy={() => copyBody(m)}
                      onDelete={() => remove(m)}
                      onOpenImage={(url) => setLightbox({ url, messageId: m.id })}
                      lang={lang}
                      nowPlayingCode={nowPlayingCode}
                      roomCode={code}
                    />
                  </Fragment>
                );
              })}
            </ul>
          )}
        </div>

        {/* Jump-to-bottom pill — a quiet white "to bottom" by default;
            when actual new messages have come in below the fold it flips
            to a rainbow-stroked, glowing "new messages!" (and pops, since
            it's re-keyed). */}
        <AnimatePresence>
          {!atBottom && messages.length > 0 && (
            <motion.div
              key={newCount > 0 ? "new" : "bottom"}
              initial={{ opacity: 0, y: 8, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 480, damping: 26 }}
              className="absolute left-1/2 -translate-x-1/2 bottom-[5.5rem] z-20"
            >
              {newCount > 0 ? (
                <button
                  type="button"
                  onClick={() => scrollToBottom(true)}
                  className="rainbow-border rounded-full block transform-gpu transition active:scale-[0.96]
                             shadow-[0_0_28px_-3px_oklch(70.55%_0.2725_336.19_/_0.7)]"
                >
                  <span className="flex items-center gap-1.5 rounded-full bg-dark-blue-900 px-4 py-2 text-xs font-display text-white">
                    <ArrowDown className="h-3.5 w-3.5" />
                    {t(lang, "chat_new_pill")}
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => scrollToBottom(true)}
                  className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-display
                             bg-white text-dark-blue shadow-lg active:scale-[0.96] transition"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                  {t(lang, "chat_jump_bottom")}
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Composer */}
        <div className="shrink-0 pb-2 pt-2 bg-gradient-to-t from-dark-blue-900 via-dark-blue-900/95 to-dark-blue-900/0">
          {/* Typing indicator */}
          {typingNames.length > 0 && !editing && (
            <p className="px-3 pb-1 text-[11px] text-white/45">
              {typingNames.length === 1
                ? t(lang, "chat_typing_one", typingNames[0])
                : typingNames.length === 2
                  ? t(lang, "chat_typing_two", typingNames[0], typingNames[1])
                  : t(lang, "chat_typing_many")}
            </p>
          )}

          {(replyTo || editing) && (
            // Sits on the right — it's about your (right-aligned) message.
            // Hard-capped so a long quote can't blow past the composer.
            <div className="mb-2 ml-auto w-fit max-w-[min(85%,22rem)] flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] ring-1 ring-white/10 text-xs">
              {editing ? (
                <>
                  <Pencil className="h-3.5 w-3.5 text-flamingo shrink-0" />
                  <p className="flex-1 min-w-0 truncate text-white/70">{t(lang, "chat_editing")}</p>
                  <button type="button" onClick={() => setEditing(null)} className="shrink-0 text-white/40 hover:text-white" aria-label={t(lang, "cancel")}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                </>
              ) : replyTo ? (
                <>
                  <Reply className="h-3.5 w-3.5 text-flamingo shrink-0" />
                  <p className="flex-1 min-w-0 truncate text-white/70">
                    <span className="font-display text-white/90">{replyTo.name}</span>
                    {": "}
                    {replyTo.body ?? (replyTo.gifUrl ? "GIF" : t(lang, "chat_card"))}
                  </p>
                  <button type="button" onClick={() => setReplyTo(null)} className="shrink-0 text-white/40 hover:text-white" aria-label={t(lang, "cancel")}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                </>
              ) : null}
            </div>
          )}
          {pendingImage && !editing && (
            <div className="mb-2 flex items-center gap-3 px-2.5 py-2 rounded-xl bg-white/[0.04] ring-1 ring-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pendingImage.url} alt="" className="h-14 w-14 rounded-lg object-cover ring-1 ring-white/12 shrink-0" />
              <span className="flex-1 min-w-0 text-xs text-white/55 truncate">{pendingImage.file.name}</span>
              <button
                type="button"
                onClick={cancelPendingImage}
                className="shrink-0 h-8 px-3 rounded-full text-xs text-white/60 hover:text-white hover:bg-white/10 transition"
              >
                {t(lang, "cancel")}
              </button>
              <button
                type="button"
                onClick={confirmPendingImage}
                disabled={uploading}
                className="shrink-0 h-8 px-3.5 rounded-full font-display text-xs bg-white text-dark-blue hover:bg-dark-blue-50 transition disabled:opacity-50"
              >
                {t(lang, "chat_image_send")}
              </button>
            </div>
          )}
          {/* Composer pill + the @-mention popover. The popover anchors
              to the pill (bottom-full of THIS wrapper, not the parent),
              so it sits flush above the keyboard line and overlays any
              reply/pending chip rather than being shoved up the screen. */}
          <div className="relative">
            <AnimatePresence>
              {mentionMatches.length > 0 && !editing && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.14 }}
                  className="absolute bottom-full left-0 right-0 mb-2 z-30 rounded-2xl bg-black/90
                             ring-1 ring-white/12 backdrop-blur-md overflow-hidden shadow-xl"
                >
                  {mentionMatches.map((n) => (
                    <button
                      key={n}
                      type="button"
                      // Don't pull focus from the composer — keeps the
                      // keyboard up, so picking a mention isn't a "tap
                      // dismisses everything" surprise.
                      onMouseDown={(e) => e.preventDefault()}
                      onTouchStart={(e) => e.preventDefault()}
                      onClick={() => insertMention(n)}
                      className="flex w-full items-center gap-2 h-12 px-4 text-sm text-white
                                 hover:bg-white/8 active:bg-white/12 transition text-left"
                    >
                      <span className="text-flamingo font-display">@</span>
                      {n}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
            {/* Composer pill. Real <form> + <input> so the keyboard's
                "send" / "go" key (and a Bluetooth keyboard Return)
                naturally submits, and iOS doesn't show the awkward
                "‹ › Done" accessory bar that <textarea> triggers.
                Single-line is fine because the chat is a quick chat:
                the toolbar already shows GIF/photo/reply, the user
                doesn't need Shift+Enter line breaks. */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (editing) submitEdit();
                else send();
              }}
              className="flex items-end gap-1 rounded-2xl border border-white/15 bg-black/40 px-1.5 py-1.5 transition focus-within:border-white/30"
            >
              <input
                ref={taRef}
                type="text"
                enterKeyHint="send"
                autoCapitalize="sentences"
                autoComplete="off"
                autoCorrect="on"
                spellCheck
                maxLength={2000}
                value={editing ? editBody : body}
                onChange={(e) => {
                  const v = e.target.value;
                  if (editing) setEditBody(v.slice(0, 2000));
                  else onComposerChange(v);
                }}
                // Belt-and-braces: iOS Safari only triggers an implicit
                // form-submit on Enter when there's exactly one text
                // input OR an explicit submit button. The hidden submit
                // below handles that; this keydown handler covers
                // bluetooth keyboards + the rare iOS Send key that
                // dispatches keydown without an accompanying submit.
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (editing) submitEdit();
                    else send();
                  }
                }}
                onPaste={editing ? undefined : onPaste}
                onFocus={() => {
                  setComposerFocused(true);
                  window.dispatchEvent(new CustomEvent("uzk:compose-focus", { detail: true }));
                }}
                onBlur={(e) => {
                  setComposerFocused(false);
                  if (!editing) clearTyping();
                  window.dispatchEvent(new CustomEvent("uzk:compose-focus", { detail: false }));

                  // iOS keyboard toolbar "Done" / checkmark dismisses
                  // the keyboard via input.blur() without moving focus
                  // anywhere else (`relatedTarget` is null). That same
                  // signature fires when the user taps a background
                  // area to dismiss too — but in this composer the
                  // GIF + Photo buttons preventDefault on mousedown so
                  // they never become the new focus target either. So
                  // the heuristic "blur with no relatedTarget AND a
                  // non-empty composer" is a clean proxy for "user
                  // signalled they're done with the keyboard". Send.
                  const text = (editing ? editBody : body).trim();
                  if (!e.relatedTarget && text) {
                    if (editing) submitEdit();
                    else send();
                  }
                }}
                placeholder={editing ? t(lang, "chat_edit_placeholder") : t(lang, "chat_placeholder")}
                className="flex-1 min-w-0 bg-transparent px-1.5 py-2
                           text-base leading-snug text-white focus:outline-none"
              />
              {/* Hidden submit button forces iOS Safari's implicit-submit
                  rule (form needs a submit button OR exactly one text
                  input — we have a hidden <input type="file"> sibling,
                  which trips the count). */}
              <button type="submit" hidden aria-hidden tabIndex={-1} />
              {!editing && (
                <div className="flex items-center gap-1 shrink-0">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    tabIndex={-1}
                    aria-hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (f) queueImage(f);
                    }}
                  />
                  <button
                    type="button"
                    // Keep the keyboard up when tapping the attach buttons.
                    onMouseDown={(e) => e.preventDefault()}
                    onTouchStart={(e) => e.preventDefault()}
                    onClick={() => setGifOpen(true)}
                    aria-label={t(lang, "gif_pick")}
                    className="h-9 px-2.5 shrink-0 rounded-full grid place-items-center text-white
                               bg-white/[0.04] hover:bg-white/15 transition active:scale-[0.92]"
                  >
                    <span className="text-[11px] font-display font-bold tracking-tight leading-none">GIF</span>
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onTouchStart={(e) => e.preventDefault()}
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    aria-label={t(lang, "chat_send_photo")}
                    className="h-9 w-9 shrink-0 rounded-full grid place-items-center text-white
                               bg-white/[0.04] hover:bg-white/15 transition active:scale-[0.92] disabled:opacity-50"
                  >
                    {uploading ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <ImagePlus className="h-[18px] w-[18px]" />}
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      </div>

      <GifPicker
        open={gifOpen}
        onClose={() => setGifOpen(false)}
        onPick={(url) => sendGif(url)}
        nowPlayingCode={nowPlayingCode}
      />
      <Lightbox url={lightbox?.url ?? null} onClose={() => setLightbox(null)} closeLabel={t(lang, "close")} />
    </main>
  );
}
