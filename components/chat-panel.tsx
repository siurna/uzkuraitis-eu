"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  Send,
  X,
  Reply,
  Pencil,
  Copy,
  Trash2,
  Smile,
  Image as ImageIcon,
  ImagePlus,
  Loader2,
  Check,
  ChevronUp,
  ArrowDown,
} from "lucide-react";
import { toast } from "sonner";
import { useEventListener, useOthers, useUpdateMyPresence } from "@/lib/liveblocks";
import { useRoomLive } from "@/components/room-shell";
import { getAvatar } from "@/lib/avatars";
import { getCountry, countryName } from "@/lib/countries";
import { HeartFlag } from "@/components/flag";
import { GifPicker } from "@/components/gif-picker";
import { useLang, t } from "@/lib/i18n";

const SESSION_KEY = "uzk_session";
const NAME_KEY = "uzk_name";
const AVATAR_KEY = "uzk_avatar";
const EDIT_WINDOW_MS = 2 * 60 * 1000;
// How many messages we keep in the DOM. The API already windows to the
// last ~50 per fetch; this is the cap once "load earlier" pages kick in.
const RENDER_CAP = 120;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const TYPING_OFF_MS = 3000;

// ---------------------------------------------------------------------
// Types

type Reactions = Record<
  string,
  { count: number; names: string[]; mine: boolean }
>;

type MessageKind =
  | "text"
  | "gif"
  | "image"
  | "bingo_strike"
  | "system"
  | "now_playing";

type Message = {
  id: string;
  sessionId: string;
  name: string;
  avatarId: string | null;
  kind: MessageKind;
  body: string | null;
  gifUrl: string | null;
  replyTo: string | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
  reactions: Reactions;
  pending?: boolean;
};

const REACTION_EMOJIS = ["❤️", "🔥", "😂", "😮", "🎤", "💯"] as const;

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

export function ChatPanel() {
  const { code } = useRoomLive();
  const lang = useLang();
  const others = useOthers();
  const updatePresence = useUpdateMyPresence();

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
  const [atBottom, setAtBottom] = useState(true);
  const [newCount, setNewCount] = useState(0);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const sessionRef = useRef<string>("");
  const listRef = useRef<HTMLDivElement | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const didInitialScroll = useRef(false);
  const atBottomRef = useRef(true);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Known participant names (presence + me) for @-mention autocomplete
  // and highlighting. Deduped, alpha-sorted.
  const myName =
    typeof window !== "undefined" ? localStorage.getItem(NAME_KEY) ?? "" : "";
  const participantNames = useMemo(() => {
    const set = new Set<string>();
    if (myName) set.add(myName);
    for (const o of others) {
      const n = o.presence?.name;
      if (n) set.add(n);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [others, myName]);

  // Who's typing right now (excluding me — useOthers already excludes self).
  const typingNames = useMemo(
    () =>
      others
        .filter((o) => o.presence?.typing && o.presence?.name)
        .map((o) => o.presence!.name as string),
    [others],
  );

  useEffect(() => {
    let s = localStorage.getItem(SESSION_KEY);
    if (!s) {
      s = `s_${Math.random().toString(36).slice(2, 14)}`;
      localStorage.setItem(SESSION_KEY, s);
    }
    sessionRef.current = s;
  }, []);

  // Clear typing presence on unmount.
  useEffect(() => {
    return () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
      updatePresence({ typing: false });
    };
  }, [updatePresence]);

  // ----- fetch (debounced) -----
  const fetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchMessages = useCallback(() => {
    if (fetchTimer.current) return;
    fetchTimer.current = setTimeout(async () => {
      fetchTimer.current = null;
      const s = sessionRef.current || localStorage.getItem(SESSION_KEY) || "";
      try {
        const res = await fetch(
          `/api/rooms/${code}/chat?session=${encodeURIComponent(s)}&limit=50`,
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
          const stillPending = prev.filter(
            (m) => m.pending && !freshIds.has(m.id),
          );
          return [...olderKept, ...fresh, ...stillPending].slice(-RENDER_CAP);
        });
      } finally {
        setLoading(false);
      }
    }, 180);
  }, [code]);

  useEffect(() => {
    fetchMessages();
    return () => {
      if (fetchTimer.current) clearTimeout(fetchTimer.current);
    };
  }, [fetchMessages]);

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
    if (!newestIso) return;
    if (atBottom && (typeof document === "undefined" || !document.hidden)) {
      updatePresence({ seenAt: newestIso });
    }
  }, [newestIso, atBottom, updatePresence]);

  // Tab-bar unread badge clear.
  useEffect(() => {
    try {
      localStorage.setItem(`uzk_chat_seen_${code}`, new Date().toISOString());
      window.dispatchEvent(new Event("uzk:chat-seen"));
    } catch {
      /* private mode */
    }
  }, [code, messages.length]);

  useEventListener(({ event }) => {
    const ev = event as { type?: string };
    if (
      ev.type === "chat:new" ||
      ev.type === "chat:react" ||
      ev.type === "chat:delete"
    ) {
      fetchMessages();
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
    const grew = messages.length - lastCount.current;
    lastCount.current = messages.length;
    if (grew <= 0) return;
    if (atBottomRef.current) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    } else {
      setNewCount((n) => n + grew);
    }
  }, [messages, loading]);

  // ----- composer / typing -----
  const onComposerChange = (v: string) => {
    setBody(v.slice(0, 2000));
    updatePresence({ typing: v.trim().length > 0 });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(
      () => updatePresence({ typing: false }),
      TYPING_OFF_MS,
    );
    // auto-grow
    const el = taRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
    }
  };
  const clearTyping = () => {
    if (typingTimer.current) clearTimeout(typingTimer.current);
    updatePresence({ typing: false });
    const el = taRef.current;
    if (el) el.style.height = "auto";
  };

  const insertMention = (name: string) => {
    setBody((b) => b.replace(/@[^\s@]*$/, `@${name} `));
    taRef.current?.focus();
  };

  const send = async () => {
    const text = body.trim();
    if (!text) return;
    const session = sessionRef.current;
    const name = localStorage.getItem(NAME_KEY) ?? "Anon";
    const avatarId = localStorage.getItem(AVATAR_KEY);
    const reply = replyTo?.id ?? null;
    const mentions = participantNames.filter((n) => mentionsName(text, n));

    const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const optimistic: Message = {
      id: tempId,
      sessionId: session,
      name,
      avatarId,
      kind: "text",
      body: text,
      gifUrl: null,
      replyTo: reply,
      meta: null,
      createdAt: new Date().toISOString(),
      reactions: {},
      pending: true,
    };
    setMessages((prev) => [...prev, optimistic]);
    setBody("");
    setReplyTo(null);
    clearTyping();
    requestAnimationFrame(() => scrollToBottom(false));

    try {
      const res = await fetch(`/api/rooms/${code}/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ session, name, avatarId, body: text, replyTo: reply, mentions }),
      });
      if (!res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        setBody(text);
        setReplyTo(replyTo);
        toast.error(t(lang, res.status === 429 ? "chat_slow_down" : "chat_send_failed"));
        return;
      }
      const data = (await res.json()) as { id?: string };
      if (data.id) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId ? { ...m, id: data.id!, pending: false } : m,
          ),
        );
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setBody(text);
      toast.error(t(lang, "chat_send_failed"));
    }
  };

  const sendGif = async (gifUrl: string) => {
    const session = sessionRef.current;
    const name = localStorage.getItem(NAME_KEY) ?? "Anon";
    const avatarId = localStorage.getItem(AVATAR_KEY);
    const reply = replyTo?.id ?? null;
    setReplyTo(null);
    requestAnimationFrame(() => scrollToBottom(false));
    await fetch(`/api/rooms/${code}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ session, name, avatarId, kind: "gif", gifUrl, replyTo: reply }),
    });
  };

  const sendImage = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error(t(lang, "chat_image_too_big"));
      return;
    }
    const session = sessionRef.current;
    const name = localStorage.getItem(NAME_KEY) ?? "Anon";
    const avatarId = localStorage.getItem(AVATAR_KEY);
    const reply = replyTo?.id ?? null;
    const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const localUrl = URL.createObjectURL(file);
    const optimistic: Message = {
      id: tempId,
      sessionId: session,
      name,
      avatarId,
      kind: "image",
      body: null,
      gifUrl: localUrl,
      replyTo: reply,
      meta: null,
      createdAt: new Date().toISOString(),
      reactions: {},
      pending: true,
    };
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
        body: JSON.stringify({ session, name, avatarId, kind: "image", gifUrl: url, replyTo: reply }),
      });
      const data = (await res.json().catch(() => ({}))) as { id?: string };
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId ? { ...m, id: data.id ?? m.id, gifUrl: url, pending: false } : m,
        ),
      );
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
      URL.revokeObjectURL(localUrl);
    }
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const item = Array.from(e.clipboardData.items).find((i) =>
      i.type.startsWith("image/"),
    );
    const file = item?.getAsFile();
    if (file) {
      e.preventDefault();
      sendImage(file);
    }
  };

  const react = async (msgId: string, emoji: string) => {
    const session = sessionRef.current;
    const name = localStorage.getItem(NAME_KEY) ?? "Anon";
    setMenuFor(null);
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== msgId) return m;
        const r = { ...m.reactions };
        const slot = r[emoji] ?? { count: 0, names: [], mine: false };
        if (slot.mine) {
          const next = {
            count: Math.max(0, slot.count - 1),
            names: slot.names.filter((n) => n !== name),
            mine: false,
          };
          if (next.count === 0) delete r[emoji];
          else r[emoji] = next;
        } else {
          r[emoji] = {
            count: slot.count + 1,
            names: [...slot.names, name],
            mine: true,
          };
        }
        return { ...m, reactions: r };
      }),
    );
    fetch(`/api/rooms/${code}/chat/${msgId}/react`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ session, name, emoji }),
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
    const session = sessionRef.current;
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
    const session = sessionRef.current;
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
      if (m.sessionId === sessionRef.current && (m.kind === "text" || m.kind === "gif" || m.kind === "image")) {
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
    // Fixed between the sticky header (h-14) and the bottom tab dock so
    // the message list owns a definite height — that's what makes
    // overflow-y-auto actually scroll, lets us pin to the bottom on
    // open, and welds the composer to the footer.
    <main
      className="fixed inset-x-0 top-14 z-10 flex justify-center px-3 sm:px-4
                 bottom-[calc(env(safe-area-inset-bottom)+4.75rem)]"
    >
      <div className="relative flex flex-col w-full max-w-3xl min-h-0">
        <div
          ref={listRef}
          onScroll={onScroll}
          className="flex-1 min-h-0 overflow-y-auto py-4 flex flex-col gap-3"
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
              <Smile className="h-6 w-6 text-white/30" />
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
                      mine={m.sessionId === sessionRef.current}
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
                      }}
                      onEdit={() => startEdit(m)}
                      onCopy={() => copyBody(m)}
                      onDelete={() => remove(m)}
                      onOpenImage={(url) => setLightbox(url)}
                      lang={lang}
                    />
                  </div>
                );
              })}
            </ul>
          )}
        </div>

        {/* Jump-to-bottom pill */}
        <AnimatePresence>
          {!atBottom && messages.length > 0 && (
            <motion.button
              type="button"
              onClick={() => scrollToBottom(true)}
              initial={{ opacity: 0, y: 8, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.9 }}
              className="absolute left-1/2 -translate-x-1/2 bottom-[5.5rem] z-20
                         flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-display
                         bg-white text-dark-blue shadow-lg active:scale-[0.96] transition"
            >
              <ArrowDown className="h-3.5 w-3.5" />
              {newCount > 0
                ? t(lang, "chat_new_messages", newCount)
                : t(lang, "chat_jump_bottom")}
            </motion.button>
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
            <div className="mb-2 flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] ring-1 ring-white/10 text-xs">
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
          <div className="flex items-end gap-2">
            <textarea
              ref={taRef}
              rows={1}
              value={editing ? editBody : body}
              onChange={(e) =>
                editing
                  ? setEditBody(e.target.value.slice(0, 2000))
                  : onComposerChange(e.target.value)
              }
              onPaste={editing ? undefined : onPaste}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (editing) submitEdit();
                  else send();
                }
              }}
              onBlur={editing ? undefined : clearTyping}
              placeholder={editing ? t(lang, "chat_edit_placeholder") : t(lang, "chat_placeholder")}
              className="flex-1 max-h-[140px] resize-none rounded-2xl border border-white/15 bg-black/40
                         px-4 py-2.5 text-base leading-snug text-white placeholder:text-white/35
                         focus:outline-none focus:border-white/30 transition"
              maxLength={2000}
            />
            {!editing && (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) sendImage(f);
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  aria-label={t(lang, "chat_send_photo")}
                  className="h-11 w-11 shrink-0 rounded-full grid place-items-center
                             bg-white/[0.06] ring-1 ring-white/12 text-white/75
                             hover:bg-white/[0.1] hover:text-white transition active:scale-[0.95]
                             disabled:opacity-50"
                >
                  {uploading ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <ImagePlus className="h-[18px] w-[18px]" />}
                </button>
                <button
                  type="button"
                  onClick={() => setGifOpen(true)}
                  aria-label={t(lang, "gif_pick")}
                  className="h-11 w-11 shrink-0 rounded-full grid place-items-center
                             bg-white/[0.06] ring-1 ring-white/12 text-white/75
                             hover:bg-white/[0.1] hover:text-white transition active:scale-[0.95]"
                >
                  <ImageIcon className="h-[18px] w-[18px]" />
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => (editing ? submitEdit() : send())}
              disabled={editing ? !editBody.trim() : !body.trim()}
              className="h-11 w-11 shrink-0 rounded-full grid place-items-center
                         bg-white text-dark-blue disabled:opacity-40 transition active:scale-[0.95]"
              aria-label={editing ? t(lang, "chat_save_edit") : t(lang, "chat_send")}
            >
              {editing ? <Check className="h-4 w-4" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>

      <GifPicker open={gifOpen} onClose={() => setGifOpen(false)} onPick={(url) => sendGif(url)} />
      <Lightbox url={lightbox} onClose={() => setLightbox(null)} closeLabel={t(lang, "close")} />
    </main>
  );
}

// ---------------------------------------------------------------------
// Fullscreen image viewer.

function Lightbox({
  url,
  onClose,
  closeLabel,
}: {
  url: string | null;
  onClose: () => void;
  closeLabel: string;
}) {
  useEffect(() => {
    if (!url) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [url, onClose]);
  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {url && (
        <motion.div
          className="fixed inset-0 z-[100] grid place-items-center bg-black/92 backdrop-blur-sm p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="absolute top-4 right-4 text-white/80 hover:text-white p-2"
          >
            <X className="h-6 w-6" />
          </button>
          <motion.img
            src={url}
            alt=""
            initial={{ scale: 0.94 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.94 }}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] max-w-[95vw] object-contain rounded-xl"
          />
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

// ---------------------------------------------------------------------
// Render @mentions inside message text as highlighted tokens. Only known
// participant names count (case-insensitive, longest match wins).

function renderBody(text: string, names: string[]): React.ReactNode {
  if (!text.includes("@") || names.length === 0) return text;
  const lower = names.map((n) => n.toLowerCase());
  const out: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < text.length) {
    if (text[i] === "@") {
      const rest = text.slice(i + 1);
      let hit: string | null = null;
      for (let j = 0; j < names.length; j++) {
        const n = names[j];
        if (rest.toLowerCase().startsWith(lower[j]) && (hit === null || n.length > hit.length)) {
          const after = rest[n.length];
          if (after === undefined || /[\s.,!?:;)"']/.test(after)) hit = n;
        }
      }
      if (hit) {
        out.push(
          <span key={key++} className="text-flamingo font-display">@{hit}</span>,
        );
        i += 1 + hit.length;
        continue;
      }
    }
    const next = text.indexOf("@", i + 1);
    const end = next === -1 ? text.length : next;
    out.push(<span key={key++}>{text.slice(i, end)}</span>);
    i = end;
  }
  return out;
}

// ---------------------------------------------------------------------
// Single message row.

function ChatRow({
  message: m,
  mine,
  parent,
  showHeader,
  menuOpen,
  participantNames,
  seenBy,
  onOpenMenu,
  onCloseMenu,
  onReact,
  onReply,
  onEdit,
  onCopy,
  onDelete,
  onOpenImage,
  lang,
}: {
  message: Message;
  mine: boolean;
  parent: Message | null;
  showHeader: boolean;
  menuOpen: boolean;
  participantNames: string[];
  seenBy: number;
  onOpenMenu: () => void;
  onCloseMenu: () => void;
  onReact: (emoji: string) => void;
  onReply: () => void;
  onEdit: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onOpenImage: (url: string) => void;
  lang: "en" | "lt";
}) {
  const avatar = m.avatarId ? getAvatar(m.avatarId) : null;
  const isCard = m.kind === "bingo_strike";
  const isSystem = m.kind === "system";
  const isNowPlaying = m.kind === "now_playing";
  const isMedia = (m.kind === "gif" || m.kind === "image") && m.gifUrl;
  const isEdited = (m.meta as { edited?: boolean } | null)?.edited === true;
  const canEdit =
    mine && m.kind === "text" &&
    Date.now() - new Date(m.createdAt).getTime() < EDIT_WINDOW_MS;

  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longFired = useRef(false);
  const startPress = () => {
    if (isSystem || isNowPlaying) return;
    longFired.current = false;
    pressTimer.current = setTimeout(() => {
      longFired.current = true;
      onOpenMenu();
    }, 450);
  };
  const cancelPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  const time = useMemo(() => {
    try {
      return new Date(m.createdAt).toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  }, [m.createdAt]);

  if (isNowPlaying) {
    const cc = (m.meta as { code?: string } | null)?.code;
    const country = cc ? getCountry(cc) : null;
    return (
      <motion.li
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="my-1"
      >
        <div className="rainbow-border rounded-2xl">
          <div className="flex items-center gap-3 rounded-[14px] bg-dark-blue-900/85 px-4 py-3">
            {country ? (
              <span className="heartbeat shrink-0">
                <HeartFlag code={country.code} size="md" />
              </span>
            ) : (
              <Smile className="h-5 w-5 text-flamingo shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-[0.3em] text-flamingo font-display leading-tight">
                {t(lang, "now_playing")}
              </p>
              <p className="text-sm text-white truncate">
                <span className="font-display">
                  {country ? countryName(country.code, lang) : (cc ?? "").toUpperCase()}
                </span>
                {country?.artist && <span className="text-white/70"> — {country.artist}</span>}
                {country?.song && <span className="text-white/45 italic"> · {country.song}</span>}
              </p>
            </div>
            <span className="text-[10px] text-white/30 tabular-nums shrink-0">{time}</span>
          </div>
        </div>
      </motion.li>
    );
  }

  if (isSystem) {
    return (
      <motion.li initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-center">
        <span className="text-[11px] text-white/40 px-3 py-1 rounded-full bg-white/[0.03]">{m.body}</span>
      </motion.li>
    );
  }

  return (
    <motion.li
      initial={m.pending ? { opacity: 0, y: 8 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex ${mine ? "justify-end" : "justify-start"}`}
    >
      <div className={`relative max-w-[82%] sm:max-w-[68%] flex gap-2 ${mine ? "flex-row-reverse" : "flex-row"}`}>
        {!mine && (
          <div className={`h-9 w-9 shrink-0 rounded-xl overflow-hidden ring-1 ring-white/10 bg-white/[0.04] ${showHeader ? "" : "invisible"}`}>
            {avatar?.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatar.photo}
                alt=""
                className="h-full w-full object-cover"
                style={{ objectPosition: avatar.focal ? `${avatar.focal.x}% ${avatar.focal.y}%` : "50% 30%" }}
              />
            ) : (
              <div className="h-full w-full grid place-items-center text-xs font-display text-white/45">
                {m.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        )}

        <div className="min-w-0 flex flex-col items-stretch gap-1">
          {showHeader && !mine && (
            <span className="text-[11px] font-display text-white/55 truncate flex items-center gap-1.5">
              {m.name}
              <span className="text-white/30 tabular-nums">{time}</span>
            </span>
          )}
          {showHeader && mine && (
            <span className="text-[11px] text-white/35 tabular-nums self-end">{time}</span>
          )}

          {parent && (
            <div className={`text-[11px] px-3 py-1.5 rounded-xl truncate bg-white/[0.03] ring-1 ring-white/10 text-white/55 ${mine ? "self-end" : "self-start"}`}>
              <Reply className="h-3 w-3 inline-block mr-1 text-flamingo" />
              <span className="font-display text-white/75">{parent.name}</span>
              {": "}
              {parent.body ?? (parent.gifUrl ? "GIF" : t(lang, "chat_card"))}
            </div>
          )}

          <div className="relative">
            <motion.button
              drag="x"
              dragSnapToOrigin
              dragConstraints={{ left: mine ? -64 : 0, right: mine ? 0 : 64 }}
              dragElastic={0.35}
              onDragEnd={(_, info) => {
                if (mine && info.offset.x < -44) onReply();
                else if (!mine && info.offset.x > 44) onReply();
              }}
              type="button"
              onClick={() => {
                if (longFired.current) {
                  longFired.current = false;
                  return;
                }
                if (isMedia && m.gifUrl) onOpenImage(m.gifUrl);
              }}
              onMouseDown={startPress}
              onMouseUp={cancelPress}
              onMouseLeave={cancelPress}
              onTouchStart={startPress}
              onTouchEnd={cancelPress}
              onTouchCancel={cancelPress}
              onContextMenu={(e) => {
                e.preventDefault();
                longFired.current = true;
                onOpenMenu();
              }}
              className={`relative text-left rounded-2xl text-sm leading-snug transition touch-none cursor-pointer overflow-hidden
                          ${isMedia ? "p-0" : "px-3.5 py-2"}
                          ${
                            isCard
                              ? "bg-flamingo/15 ring-1 ring-flamingo/40 text-white px-3.5 py-2"
                              : mine
                                ? "bg-white text-dark-blue"
                                : "bg-white/[0.06] ring-1 ring-white/10 text-white/90"
                          } ${m.pending ? "opacity-75" : ""}`}
            >
              {isCard ? (
                <BingoCardMessage meta={m.meta} />
              ) : isMedia ? (
                <span className="relative block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.gifUrl!} alt="" className="block max-h-60 w-auto rounded-2xl" />
                  {m.kind === "image" && m.pending && (
                    <span className="absolute inset-0 grid place-items-center bg-black/30 rounded-2xl">
                      <Loader2 className="h-5 w-5 text-white animate-spin" />
                    </span>
                  )}
                </span>
              ) : (
                <>
                  <span className="whitespace-pre-wrap break-words">
                    {renderBody(m.body ?? "", participantNames)}
                  </span>
                  {isEdited && (
                    <span className="text-[10px] opacity-50 ml-1.5">({t(lang, "chat_edited")})</span>
                  )}
                </>
              )}
            </motion.button>

            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.85, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.85, y: 8 }}
                  transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                  onClick={(e) => e.stopPropagation()}
                  className={`absolute bottom-full mb-1.5 z-30 flex flex-col gap-1 ${mine ? "right-0 items-end" : "left-0 items-start"}`}
                >
                  <div className="flex items-center gap-1 p-1.5 rounded-full bg-black/80 ring-1 ring-white/12 backdrop-blur-md shadow-xl">
                    {REACTION_EMOJIS.map((e) => (
                      <button
                        key={e}
                        type="button"
                        onClick={() => onReact(e)}
                        className="h-8 w-8 rounded-full grid place-items-center hover:bg-white/10 transition text-base"
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-col rounded-2xl bg-black/80 ring-1 ring-white/12 backdrop-blur-md overflow-hidden shadow-xl min-w-[10rem]">
                    <MenuAction onClick={onReply} icon={Reply} label={t(lang, "chat_reply")} />
                    {canEdit && <MenuAction onClick={onEdit} icon={Pencil} label={t(lang, "chat_edit")} />}
                    {m.body && <MenuAction onClick={onCopy} icon={Copy} label={t(lang, "chat_copy")} />}
                    {mine && <MenuAction onClick={onDelete} icon={Trash2} label={t(lang, "chat_delete")} danger />}
                    <MenuAction onClick={onCloseMenu} icon={X} label={t(lang, "cancel")} muted />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {Object.keys(m.reactions).length > 0 && (
            <div className={`flex flex-wrap gap-1 ${mine ? "self-end" : "self-start"}`}>
              {Object.entries(m.reactions).map(([emoji, info]) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => onReact(emoji)}
                  title={info.names.join(", ")}
                  className={`px-2 h-6 rounded-full text-xs font-display inline-flex items-center gap-1 transition
                              ${
                                info.mine
                                  ? "bg-flamingo/25 ring-1 ring-flamingo/45 text-white"
                                  : "bg-white/[0.06] ring-1 ring-white/10 text-white/80 hover:bg-white/[0.10]"
                              }`}
                >
                  <span className="leading-none">{emoji}</span>
                  <span className="tabular-nums">{info.count}</span>
                </button>
              ))}
            </div>
          )}

          {mine && seenBy > 0 && (
            <span className="text-[10px] text-white/35 self-end">
              {t(lang, "chat_seen_by", seenBy)}
            </span>
          )}
        </div>
      </div>
    </motion.li>
  );
}

function MenuAction({
  onClick,
  icon: Icon,
  label,
  muted,
  danger,
}: {
  onClick: () => void;
  icon: typeof Reply;
  label: string;
  muted?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-between px-4 py-2.5 text-sm hover:bg-white/8 transition
                  ${danger ? "text-error" : muted ? "text-white/55" : "text-white"}`}
    >
      <span>{label}</span>
      <Icon className={`h-4 w-4 ${danger ? "text-error/80" : "text-white/55"}`} />
    </button>
  );
}

function BingoCardMessage({ meta }: { meta: Record<string, unknown> | null }) {
  const trope = (meta?.trope as string) ?? "";
  const won = !!meta?.bingo;
  return (
    <span className="inline-flex items-center gap-2">
      <Smile className="h-4 w-4 text-flamingo shrink-0" />
      <span>
        {won && <strong className="font-display">BINGO! </strong>}
        <span className="opacity-90">{trope}</span>
      </span>
    </span>
  );
}
