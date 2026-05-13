"use client";

import {
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
import { useEventListener, useOthers, useUpdateMyPresence } from "@/lib/liveblocks";
import { useRoomLive } from "@/components/room-shell";
import { useIdentity } from "@/lib/use-identity";
import { GifPicker } from "@/components/gif-picker";
import { ChatRow, type Message } from "@/components/chat-row";
import { Lightbox } from "@/components/chat-lightbox";
import { useLang, t } from "@/lib/i18n";
import { haptic } from "@/lib/haptics";

// How many messages we keep in the DOM. The API already windows to the
// last ~50 per fetch; this is the cap once "load earlier" pages kick in.
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
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  // The current visual viewport (the bit of the page that's actually
  // visible — i.e. above the on-screen keyboard). The chat panel is
  // sized to this directly, so the composer always sits flush above the
  // keyboard with no dead gap. `composerFocused` toggles whether we
  // reserve space for the bottom dock (it's hidden while typing).
  const [viewport, setViewport] = useState<{ h: number; top: number } | null>(null);
  const [composerFocused, setComposerFocused] = useState(false);
  const dragDepth = useRef(0);

  const listRef = useRef<HTMLDivElement | null>(null);
  // The composer is a contentEditable <div> (an experiment — dodges the
  // iOS keyboard accessory bar that <textarea>/<input> always get).
  const taRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const didInitialScroll = useRef(false);
  const atBottomRef = useRef(true);
  // Messages just prepended by "load earlier" — they must NOT count
  // toward the "N new messages" badge (they're history, not arrivals).
  const prependedRef = useRef(0);
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
        return [...olderKept, ...fresh, ...stillPending].slice(-RENDER_CAP);
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
        }
      }
    } catch {
      /* private mode / corrupt */
    }
    fetchMessages(true);
    return () => {
      if (fetchTimer.current) clearTimeout(fetchTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // Keep the cache warm for the next tab switch.
  useEffect(() => {
    if (messages.length === 0) return;
    try {
      sessionStorage.setItem(
        `uzk_chat_cache_${code}`,
        JSON.stringify(messages.filter((m) => !m.pending).slice(-50)),
      );
    } catch {
      /* ignore */
    }
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
      const res = await fetch(
        `/api/rooms/${code}/chat?before=${encodeURIComponent(oldest.createdAt)}&limit=50`,
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
  // showing (the panel stays mounted on other tabs).
  useEffect(() => {
    if (!active) return;
    try {
      localStorage.setItem(`uzk_chat_seen_${code}`, new Date().toISOString());
      window.dispatchEvent(new Event("uzk:chat-seen"));
    } catch {
      /* private mode */
    }
  }, [code, active, messages.length]);

  useEventListener(({ event }) => {
    const ev = event as { type?: string; id?: string };
    if (ev.type === "chat:delete") {
      if (ev.id) setMessages((prev) => prev.filter((m) => m.id !== ev.id));
      return;
    }
    if (ev.type === "chat:new") {
      // Our own message — already shown optimistically. Skipping the
      // refetch keeps the local blob preview from flashing to the
      // server URL.
      if (ev.id && byId.has(ev.id)) return;
      fetchMessages();
      return;
    }
    if (ev.type === "chat:react") fetchMessages();
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

  // Swipe / tap to reply: anchor the replied-to message in the middle so
  // the list doesn't jump somewhere random. Re-runs once the keyboard's
  // up (composerFocused flips) so it stays centred after the resize.
  useEffect(() => {
    if (!replyTo) return;
    const id = replyTo.id;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        listRef.current
          ?.querySelector<HTMLElement>(`[data-msg-id="${id}"]`)
          ?.scrollIntoView({ block: "center", behavior: "smooth" });
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [replyTo, composerFocused]);

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
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
        setBody(text);
        setReplyTo(replyTo);
        toast.error(t(lang, res.status === 429 ? "chat_slow_down" : "chat_send_failed"));
        return;
      }
      const data = (await res.json()) as { id?: string };
      if (data.id) {
        setMessages((prev) =>
          prev.map((m) => (m.id === optimistic.id ? { ...m, id: data.id!, pending: false } : m)),
        );
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setBody(text);
      toast.error(t(lang, "chat_send_failed"));
    }
  };

  const sendGif = async (gifUrl: string) => {
    const reply = replyTo?.id ?? null;
    setReplyTo(null);
    requestAnimationFrame(() => scrollToBottom(false));
    await fetch(`/api/rooms/${code}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ session: mySession, name: senderName, avatarId, kind: "gif", gifUrl, replyTo: reply }),
    });
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
      setMessages((prev) =>
        prev.map((m) => (m.id === optimistic.id ? { ...m, id: realId, pending: false } : m)),
      );
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
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      toast.error((err as Error).message);
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
        }
        return { ...m, reactions: r };
      }),
    );
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
      fetchMessages();
      toast.error(t(lang, "chat_edit_failed"));
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
      fetchMessages();
      toast.error(t(lang, "chat_delete_failed"));
    }
  };

  const copyBody = (m: Message) => {
    setMenuFor(null);
    const text = m.body ?? "";
    if (!text) return;
    navigator.clipboard.writeText(text).catch(() => {});
    toast.success(t(lang, "chat_copied"));
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
        composerFocused
          ? "pt-[env(safe-area-inset-top)]"
          : "pt-[calc(env(safe-area-inset-top)+3.5rem)]"
      }`}
      style={{
        top: viewport?.top ?? 0,
        height: viewport
          ? composerFocused
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
          // Scrolling the history with a finger dismisses the keyboard,
          // the way every native chat does.
          onTouchMove={() => {
            if (document.activeElement === taRef.current) taRef.current?.blur();
          }}
          className="flex-1 min-h-0 overflow-y-auto py-4 flex flex-col gap-3 fade-scroll-y"
          onClick={() => menuFor && setMenuFor(null)}
        >
          {loading ? (
            <ul className="flex flex-col gap-3">
              {[0, 1, 2].map((i) => (
                <li key={i} className="h-12 rounded-2xl bg-white/[0.04] animate-pulse" />
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
                               rounded-full px-3 py-1.5 bg-white/[0.04] ring-1 ring-white/8 transition
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
                  <div key={m.id} className="contents">
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
                      onOpenImage={(url) => setLightbox(url)}
                      lang={lang}
                      nowPlayingCode={nowPlayingCode}
                      roomCode={code}
                    />
                  </div>
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
        <div className="shrink-0 pb-2 pt-2 bg-gradient-to-t from-dark-blue-900 via-dark-blue-900/95 to-dark-blue-900/0 relative">
          {/* @-mention autocomplete */}
          <AnimatePresence>
            {mentionMatches.length > 0 && !editing && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.14 }}
                className="absolute bottom-full left-0 right-0 mb-2 rounded-2xl bg-black/85
                           ring-1 ring-white/12 backdrop-blur-md overflow-hidden shadow-xl"
              >
                {mentionMatches.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => insertMention(n)}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-white
                               hover:bg-white/8 transition text-left"
                  >
                    <span className="text-flamingo font-display">@</span>
                    {n}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

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
            <div className="mb-2 ml-auto max-w-[85%] flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] ring-1 ring-white/10 text-xs">
              {editing ? (
                <>
                  <Pencil className="h-3.5 w-3.5 text-flamingo" />
                  <p className="flex-1 truncate text-white/70">{t(lang, "chat_editing")}</p>
                  <button type="button" onClick={() => setEditing(null)} className="text-white/40 hover:text-white" aria-label={t(lang, "cancel")}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                </>
              ) : replyTo ? (
                <>
                  <Reply className="h-3.5 w-3.5 text-flamingo" />
                  <p className="flex-1 truncate text-white/70">
                    <span className="font-display text-white/90">{replyTo.name}</span>
                    {": "}
                    {replyTo.body ?? (replyTo.gifUrl ? "GIF" : t(lang, "chat_card"))}
                  </p>
                  <button type="button" onClick={() => setReplyTo(null)} className="text-white/40 hover:text-white" aria-label={t(lang, "cancel")}>
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
          {/* Composer pill. No send button — Enter (or the keyboard's
              "send" key) sends. Photo + GIF sit on the right. */}
          <div className="flex items-end gap-1 rounded-2xl border border-white/15 bg-black/40 px-1.5 py-1.5 transition focus-within:border-white/30">
            <ContentEditableInput
              innerRef={taRef}
              enterKeyHint="send"
              value={editing ? editBody : body}
              onChange={(v) =>
                editing ? setEditBody(v.slice(0, 2000)) : onComposerChange(v)
              }
              onPaste={editing ? undefined : onPaste}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (editing) submitEdit();
                  else send();
                }
              }}
              onFocus={() => {
                setComposerFocused(true);
                window.dispatchEvent(new CustomEvent("uzk:compose-focus", { detail: true }));
              }}
              onBlur={() => {
                setComposerFocused(false);
                if (!editing) clearTyping();
                window.dispatchEvent(new CustomEvent("uzk:compose-focus", { detail: false }));
              }}
              placeholder={editing ? t(lang, "chat_edit_placeholder") : t(lang, "chat_placeholder")}
              className="flex-1 min-w-0 max-h-[120px] overflow-y-auto bg-transparent px-1.5 py-2
                         text-base leading-snug text-white whitespace-pre-wrap break-words focus:outline-none"
            />
            {!editing && (
              <div className="flex items-center gap-0.5 shrink-0">
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
                  onClick={() => setGifOpen(true)}
                  aria-label={t(lang, "gif_pick")}
                  className="h-9 px-2 shrink-0 rounded-full grid place-items-center text-white/55
                             hover:text-white hover:bg-white/10 transition active:scale-[0.92]"
                >
                  <span className="text-[11px] font-display font-bold tracking-tight leading-none">GIF</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  aria-label={t(lang, "chat_send_photo")}
                  className="h-9 w-9 shrink-0 rounded-full grid place-items-center text-white/55
                             hover:text-white hover:bg-white/10 transition active:scale-[0.92] disabled:opacity-50"
                >
                  {uploading ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <ImagePlus className="h-[18px] w-[18px]" />}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <GifPicker open={gifOpen} onClose={() => setGifOpen(false)} onPick={(url) => sendGif(url)} />
      <Lightbox url={lightbox} onClose={() => setLightbox(null)} closeLabel={t(lang, "close")} />
    </main>
  );
}

// ── contentEditable composer ─────────────────────────────────────────
// Experimental replacement for the <textarea>: a contentEditable <div>
// doesn't get iOS Safari's "‹ › Done" keyboard accessory bar. We keep it
// behaving like a plain-text field: paste is sanitised to plain text,
// Shift+Enter inserts a single line break (not a nested <div>), the
// length is clamped, and the DOM text is only written from the outside
// when `value` changes from somewhere other than typing (send clears it,
// edit-mode pre-fills it, @mention insert rewrites it). `data-empty`
// drives the CSS placeholder (see globals.css).
function ContentEditableInput({
  value,
  onChange,
  onKeyDown,
  onPaste,
  onFocus,
  onBlur,
  placeholder,
  className,
  innerRef,
  maxLength = 2000,
  enterKeyHint,
}: {
  value: string;
  onChange: (v: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  onPaste?: (e: React.ClipboardEvent<HTMLDivElement>) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  placeholder: string;
  className?: string;
  innerRef: React.RefObject<HTMLDivElement | null>;
  maxLength?: number;
  enterKeyHint?: React.HTMLAttributes<HTMLDivElement>["enterKeyHint"];
}) {
  const caretToEnd = (el: HTMLElement) => {
    const r = document.createRange();
    r.selectNodeContents(el);
    r.collapse(false);
    const s = window.getSelection();
    s?.removeAllRanges();
    s?.addRange(r);
  };

  // Mirror external value changes into the DOM (no-op while typing, since
  // `value` already equals the DOM text then).
  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const cur = el.innerText === "\n" ? "" : el.innerText;
    if (cur !== value) {
      el.innerText = value;
      if (document.activeElement === el) caretToEnd(el);
    }
    el.toggleAttribute("data-empty", value.length === 0);
  }, [value, innerRef]);

  const readAndEmit = (el: HTMLElement) => {
    let text = el.innerText;
    if (text === "\n") text = "";
    if (text.length > maxLength) {
      text = text.slice(0, maxLength);
      el.innerText = text;
      caretToEnd(el);
    }
    el.toggleAttribute("data-empty", text.length === 0);
    onChange(text);
  };

  return (
    <div
      ref={innerRef}
      role="textbox"
      aria-multiline="true"
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder}
      enterKeyHint={enterKeyHint}
      autoCapitalize="sentences"
      onInput={(e) => readAndEmit(e.currentTarget)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.shiftKey) {
          e.preventDefault();
          document.execCommand("insertLineBreak");
          return;
        }
        onKeyDown?.(e);
      }}
      onPaste={(e) => {
        const hasImage = Array.from(e.clipboardData.items).some((i) =>
          i.type.startsWith("image/"),
        );
        if (hasImage) {
          if (onPaste) onPaste(e);
          else e.preventDefault();
          return;
        }
        e.preventDefault();
        const txt = e.clipboardData.getData("text/plain");
        if (txt) document.execCommand("insertText", false, txt);
      }}
      onFocus={onFocus}
      onBlur={onBlur}
      className={className}
    />
  );
}
