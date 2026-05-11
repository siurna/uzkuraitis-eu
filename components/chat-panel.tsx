"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Send,
  X,
  Reply,
  Pencil,
  Copy,
  Smile,
  Sticker,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { useEventListener } from "@/lib/liveblocks";
import { useRoomLive } from "@/components/room-shell";
import { getAvatar } from "@/lib/avatars";
import { GifPicker } from "@/components/gif-picker";
import { useLang, t } from "@/lib/i18n";

const SESSION_KEY = "uzk_session";
const NAME_KEY = "uzk_name";
const AVATAR_KEY = "uzk_avatar";
const EDIT_WINDOW_MS = 2 * 60 * 1000;

// ---------------------------------------------------------------------
// Types

type Reactions = Record<
  string,
  { count: number; names: string[]; mine: boolean }
>;

type MessageKind = "text" | "gif" | "bingo_strike" | "system";

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

export function ChatPanel() {
  const { code } = useRoomLive();
  const lang = useLang();

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [editBody, setEditBody] = useState("");
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [gifOpen, setGifOpen] = useState(false);

  const sessionRef = useRef<string>("");
  const listRef = useRef<HTMLDivElement | null>(null);
  const didInitialScroll = useRef(false);

  useEffect(() => {
    let s = localStorage.getItem(SESSION_KEY);
    if (!s) {
      s = `s_${Math.random().toString(36).slice(2, 14)}`;
      localStorage.setItem(SESSION_KEY, s);
    }
    sessionRef.current = s;
  }, []);

  const fetchMessages = useCallback(async () => {
    const s = sessionRef.current || localStorage.getItem(SESSION_KEY) || "";
    try {
      const res = await fetch(
        `/api/rooms/${code}/chat?session=${encodeURIComponent(s)}`,
        { cache: "no-store" },
      );
      if (!res.ok) return;
      const data = (await res.json()) as { messages: Message[] };
      setMessages((prev) => {
        const fresh = data.messages;
        const freshIds = new Set(fresh.map((m) => m.id));
        const stillPending = prev.filter(
          (m) => m.pending && !freshIds.has(m.id),
        );
        return [...fresh, ...stillPending];
      });
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Mark chat as seen whenever we're on this tab and a message lands —
  // clears the tab-bar unread badge.
  useEffect(() => {
    const stamp = () => {
      try {
        localStorage.setItem(`uzk_chat_seen_${code}`, new Date().toISOString());
        window.dispatchEvent(new Event("uzk:chat-seen"));
      } catch {
        /* private mode */
      }
    };
    stamp();
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

  // FIRST render: jump straight to the bottom WITHOUT animation so the
  // chat opens on the newest message with zero scroll-lag, even with
  // a full page of history. Subsequent appends smooth-scroll, but only
  // if the user is already near the bottom (so reading old messages
  // isn't yanked away).
  const lastCount = useRef(0);
  useLayoutEffect(() => {
    if (loading || !listRef.current) return;
    const el = listRef.current;
    if (!didInitialScroll.current) {
      el.scrollTop = el.scrollHeight; // instant
      didInitialScroll.current = true;
      lastCount.current = messages.length;
      return;
    }
    if (messages.length === lastCount.current) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 220;
    lastCount.current = messages.length;
    if (nearBottom) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = async (e?: FormEvent) => {
    e?.preventDefault();
    const text = body.trim();
    if (!text) return;
    const session = sessionRef.current;
    const name = localStorage.getItem(NAME_KEY) ?? "Anon";
    const avatarId = localStorage.getItem(AVATAR_KEY);
    const reply = replyTo?.id ?? null;

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

    try {
      const res = await fetch(`/api/rooms/${code}/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ session, name, avatarId, body: text, replyTo: reply }),
      });
      if (!res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        setBody(text);
        setReplyTo(replyTo);
        toast.error(t(lang, "chat_send_failed"));
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
    await fetch(`/api/rooms/${code}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ session, name, avatarId, kind: "gif", gifUrl, replyTo: reply }),
    });
  };

  // Optimistic reaction toggle — flip it in local state immediately so
  // the strip never feels laggy; the broadcast refetch reconciles.
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

  return (
    <main className="flex-1 flex flex-col container mx-auto max-w-3xl px-3 sm:px-4 w-full">
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto py-4 flex flex-col gap-3"
        // Tapping empty space closes any open message menu.
        onClick={() => menuFor && setMenuFor(null)}
      >
        {loading ? (
          <ul className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <li
                key={i}
                className="h-12 rounded-2xl bg-white/[0.04] animate-pulse"
              />
            ))}
          </ul>
        ) : messages.length === 0 ? (
          <div className="flex-1 grid place-items-center text-center text-white/45 gap-2">
            <Smile className="h-6 w-6 text-white/30" />
            <p className="text-sm">{t(lang, "chat_empty")}</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            <AnimatePresence initial={false}>
              {messages.map((m, idx) => {
                const prev = messages[idx - 1] ?? null;
                const sameAuthor =
                  prev && prev.sessionId === m.sessionId && prev.kind === m.kind &&
                  m.kind === "text" && prev.kind === "text";
                return (
                  <ChatRow
                    key={m.id}
                    message={m}
                    mine={m.sessionId === sessionRef.current}
                    parent={m.replyTo ? byId.get(m.replyTo) ?? null : null}
                    showHeader={!sameAuthor}
                    menuOpen={menuFor === m.id}
                    onOpenMenu={() => setMenuFor(m.id)}
                    onCloseMenu={() => setMenuFor(null)}
                    onReact={(emoji) => react(m.id, emoji)}
                    onReply={() => {
                      setReplyTo(m);
                      setMenuFor(null);
                    }}
                    onEdit={() => startEdit(m)}
                    onCopy={() => copyBody(m)}
                    lang={lang}
                  />
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </div>

      {/* Pinned composer — sticky to the bottom of the chat column. */}
      <div className="sticky bottom-0 pb-2 pt-2 bg-gradient-to-t from-dark-blue-900 via-dark-blue-900/95 to-dark-blue-900/0">
        {(replyTo || editing) && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-2 flex items-center gap-2 px-3 py-2 rounded-xl
                       bg-white/[0.04] ring-1 ring-white/10 text-xs"
          >
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
          </motion.div>
        )}
        <form
          onSubmit={editing ? (e) => { e.preventDefault(); submitEdit(); } : send}
          className="flex items-center gap-2"
        >
          {/* GIF picker trigger lives INSIDE the input pill (left side),
              Twitter-style — a small "GIF" badge. */}
          <div className="relative flex-1">
            {!editing && (
              <button
                type="button"
                onClick={() => setGifOpen(true)}
                aria-label={t(lang, "gif_pick")}
                className="absolute left-1.5 top-1/2 -translate-y-1/2 h-8 px-2
                           rounded-full bg-white/10 ring-1 ring-white/15
                           text-[10px] font-display tracking-wider text-white/75
                           hover:bg-white/15 hover:text-white transition
                           flex items-center gap-1"
              >
                <Sticker className="h-3.5 w-3.5" />
                GIF
              </button>
            )}
            <input
              value={editing ? editBody : body}
              onChange={(e) =>
                editing
                  ? setEditBody(e.target.value.slice(0, 2000))
                  : setBody(e.target.value.slice(0, 2000))
              }
              placeholder={editing ? t(lang, "chat_edit_placeholder") : t(lang, "chat_placeholder")}
              className={`w-full h-11 rounded-full border border-white/15 bg-black/40
                         pr-4 text-base text-white placeholder:text-white/35
                         focus:outline-none focus:border-white/30 transition
                         ${editing ? "pl-4" : "pl-[4.25rem]"}`}
              maxLength={2000}
            />
          </div>
          <button
            type="submit"
            disabled={editing ? !editBody.trim() : !body.trim()}
            className="h-11 w-11 rounded-full grid place-items-center
                       bg-white text-dark-blue disabled:opacity-40
                       transition active:scale-[0.95]"
            aria-label={editing ? t(lang, "chat_save_edit") : t(lang, "chat_send")}
          >
            {editing ? <Check className="h-4 w-4" /> : <Send className="h-4 w-4" />}
          </button>
        </form>
      </div>

      <GifPicker open={gifOpen} onClose={() => setGifOpen(false)} onPick={(url) => sendGif(url)} />
    </main>
  );
}

// ---------------------------------------------------------------------
// Single message row.

function ChatRow({
  message: m,
  mine,
  parent,
  showHeader,
  menuOpen,
  onOpenMenu,
  onCloseMenu,
  onReact,
  onReply,
  onEdit,
  onCopy,
  lang,
}: {
  message: Message;
  mine: boolean;
  parent: Message | null;
  showHeader: boolean;
  menuOpen: boolean;
  onOpenMenu: () => void;
  onCloseMenu: () => void;
  onReact: (emoji: string) => void;
  onReply: () => void;
  onEdit: () => void;
  onCopy: () => void;
  lang: "en" | "lt";
}) {
  const avatar = m.avatarId ? getAvatar(m.avatarId) : null;
  const isCard = m.kind === "bingo_strike";
  const isSystem = m.kind === "system";
  const isGif = m.kind === "gif" && m.gifUrl;
  const isEdited = (m.meta as { edited?: boolean } | null)?.edited === true;
  const canEdit =
    mine && m.kind === "text" &&
    Date.now() - new Date(m.createdAt).getTime() < EDIT_WINDOW_MS;

  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPress = () => {
    if (isSystem) return;
    pressTimer.current = setTimeout(() => onOpenMenu(), 450);
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

  // System messages render centred + muted, no avatar, no actions.
  if (isSystem) {
    return (
      <motion.li
        layout
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex justify-center"
      >
        <span className="text-[11px] text-white/40 px-3 py-1 rounded-full bg-white/[0.03]">
          {m.body}
        </span>
      </motion.li>
    );
  }

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.22 }}
      className={`flex ${mine ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`relative max-w-[82%] sm:max-w-[68%] flex gap-2 ${
          mine ? "flex-row-reverse" : "flex-row"
        }`}
      >
        {!mine && (
          <div
            className={`h-9 w-9 shrink-0 rounded-xl overflow-hidden ring-1 ring-white/10 bg-white/[0.04] ${
              showHeader ? "" : "invisible"
            }`}
          >
            {avatar?.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatar.photo}
                alt=""
                className="h-full w-full object-cover"
                style={{
                  objectPosition: avatar.focal
                    ? `${avatar.focal.x}% ${avatar.focal.y}%`
                    : "50% 30%",
                }}
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
            <div
              className={`text-[11px] px-3 py-1.5 rounded-xl truncate
                          bg-white/[0.03] ring-1 ring-white/10 text-white/55
                          ${mine ? "self-end" : "self-start"}`}
            >
              <Reply className="h-3 w-3 inline-block mr-1 text-flamingo" />
              <span className="font-display text-white/75">{parent.name}</span>
              {": "}
              {parent.body ?? (parent.gifUrl ? "GIF" : t(lang, "chat_card"))}
            </div>
          )}

          {/* Bubble. Drag-x → swipe-to-reply; long-press / right-click
              → action menu (rendered as an OVERLAY anchored to the
              bubble, so it never pushes the list and never induces
              scroll). */}
          <div className="relative">
            <motion.button
              drag="x"
              dragConstraints={{ left: mine ? -64 : 0, right: mine ? 0 : 64 }}
              dragElastic={0.4}
              onDragEnd={(_, info) => {
                if (mine && info.offset.x < -44) onReply();
                else if (!mine && info.offset.x > 44) onReply();
              }}
              type="button"
              onMouseDown={startPress}
              onMouseUp={cancelPress}
              onMouseLeave={cancelPress}
              onTouchStart={startPress}
              onTouchEnd={cancelPress}
              onTouchCancel={cancelPress}
              onContextMenu={(e) => {
                e.preventDefault();
                onOpenMenu();
              }}
              className={`relative text-left rounded-2xl text-sm leading-snug
                          transition touch-none cursor-pointer overflow-hidden
                          ${isGif ? "p-0" : "px-3.5 py-2"}
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
              ) : isGif ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.gifUrl!} alt="" className="block max-h-60 w-auto rounded-2xl" />
              ) : (
                <>
                  <span className="whitespace-pre-wrap break-words">{m.body}</span>
                  {isEdited && (
                    <span className="text-[10px] opacity-50 ml-1.5">({t(lang, "chat_edited")})</span>
                  )}
                </>
              )}
            </motion.button>

            {/* Menu overlay — absolute, anchored above the bubble.
                pointer-events on the panel only; clicking the list
                background (handled in ChatPanel) closes it. */}
            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.85, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.85, y: 8 }}
                  transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                  onClick={(e) => e.stopPropagation()}
                  className={`absolute bottom-full mb-1.5 z-30 flex flex-col gap-1
                              ${mine ? "right-0 items-end" : "left-0 items-start"}`}
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
                    <MenuAction onClick={onCloseMenu} icon={X} label={t(lang, "cancel")} muted />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Reactions strip */}
          {Object.keys(m.reactions).length > 0 && (
            <div className={`flex flex-wrap gap-1 ${mine ? "self-end" : "self-start"}`}>
              {Object.entries(m.reactions).map(([emoji, info]) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => onReact(emoji)}
                  title={info.names.join(", ")}
                  className={`px-2 h-6 rounded-full text-xs font-display
                              inline-flex items-center gap-1 transition
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
}: {
  onClick: () => void;
  icon: typeof Reply;
  label: string;
  muted?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-between px-4 py-2.5 text-sm
                  hover:bg-white/8 transition ${muted ? "text-white/55" : "text-white"}`}
    >
      <span>{label}</span>
      <Icon className="h-4 w-4 text-white/55" />
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
