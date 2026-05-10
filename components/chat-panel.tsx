"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { motion, AnimatePresence } from "motion/react";
import { Send, X, Reply, Trash2, Smile, Image as ImageIcon, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useEventListener } from "@/lib/liveblocks";
import { useRoomLive } from "@/components/room-shell";
import { getAvatar } from "@/lib/avatars";
import { useLang, t } from "@/lib/i18n";

const SESSION_KEY = "uzk_session";
const NAME_KEY = "uzk_name";
const AVATAR_KEY = "uzk_avatar";

// ---------------------------------------------------------------------
// Types

type Reactions = Record<
  string,
  { count: number; names: string[]; mine: boolean }
>;

type Message = {
  id: string;
  sessionId: string;
  name: string;
  avatarId: string | null;
  kind: "text" | "gif" | "bingo_strike";
  body: string | null;
  gifUrl: string | null;
  replyTo: string | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
  reactions: Reactions;
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
  const [holding, setHolding] = useState<string | null>(null);

  const sessionRef = useRef<string>("");
  const listRef = useRef<HTMLDivElement | null>(null);

  // Init session lazily — same key as votes/bingo.
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
      setMessages(data.messages);
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Server fans chat:new / chat:react / chat:delete after writes;
  // refetch the page on any of those.
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

  // Auto-scroll on new messages (only if user is already near bottom).
  const lastCount = useRef(0);
  useEffect(() => {
    if (!listRef.current) return;
    if (messages.length === lastCount.current) return;
    const el = listRef.current;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 200;
    lastCount.current = messages.length;
    if (nearBottom) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [messages]);

  const send = async () => {
    const text = body.trim();
    if (!text) return;
    const session = sessionRef.current;
    const name = localStorage.getItem(NAME_KEY) ?? "Anon";
    const avatarId = localStorage.getItem(AVATAR_KEY);
    const reply = replyTo?.id ?? null;
    setBody("");
    setReplyTo(null);
    try {
      const res = await fetch(`/api/rooms/${code}/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          session,
          name,
          avatarId,
          body: text,
          replyTo: reply,
        }),
      });
      if (!res.ok) {
        toast.error(t(lang, "chat_send_failed"));
        setBody(text);
        setReplyTo(replyTo);
      }
    } catch {
      toast.error(t(lang, "chat_send_failed"));
      setBody(text);
    }
  };

  const react = async (msgId: string, emoji: string) => {
    const session = sessionRef.current;
    const name = localStorage.getItem(NAME_KEY) ?? "Anon";
    setHolding(null);
    await fetch(`/api/rooms/${code}/chat/${msgId}/react`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ session, name, emoji }),
    });
  };

  const remove = async (msgId: string) => {
    const session = sessionRef.current;
    await fetch(
      `/api/rooms/${code}/chat/${msgId}?session=${encodeURIComponent(session)}`,
      { method: "DELETE" },
    );
  };

  // Lookup table for reply previews.
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
            <Sparkles className="h-6 w-6 text-white/30" />
            <p className="text-sm">{t(lang, "chat_empty")}</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            <AnimatePresence initial={false}>
              {messages.map((m) => (
                <ChatRow
                  key={m.id}
                  message={m}
                  mine={m.sessionId === sessionRef.current}
                  parent={m.replyTo ? byId.get(m.replyTo) ?? null : null}
                  reactionsOpen={holding === m.id}
                  onHoldStart={() => setHolding(m.id)}
                  onHoldEnd={() => setHolding(null)}
                  onReact={(emoji) => react(m.id, emoji)}
                  onReply={() => setReplyTo(m)}
                  onDelete={() => remove(m.id)}
                  lang={lang}
                />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>

      <div className="sticky bottom-0 pb-2 pt-2 bg-gradient-to-t from-dark-blue-900 via-dark-blue-900/95 to-dark-blue-900/0">
        {replyTo && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-2 flex items-center gap-2 px-3 py-2 rounded-xl
                       bg-white/[0.04] ring-1 ring-white/10 text-xs"
          >
            <Reply className="h-3.5 w-3.5 text-flamingo" />
            <p className="flex-1 truncate text-white/70">
              <span className="font-display text-white/90">{replyTo.name}</span>
              {": "}
              {replyTo.body ?? (replyTo.gifUrl ? "GIF" : t(lang, "chat_card"))}
            </p>
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              className="text-white/40 hover:text-white"
              aria-label={t(lang, "cancel")}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="flex items-center gap-2"
        >
          <input
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, 2000))}
            placeholder={t(lang, "chat_placeholder")}
            className="heartbeat-focus flex-1 h-11 rounded-full
                       border border-white/15 bg-black/40 px-4 text-base
                       text-white placeholder:text-white/35
                       focus:outline-none"
            maxLength={2000}
          />
          <button
            type="button"
            disabled
            title="GIFs (coming with Klipy)"
            className="h-11 w-11 rounded-full grid place-items-center
                       bg-white/[0.04] ring-1 ring-white/10
                       text-white/30 cursor-not-allowed"
            aria-label="GIFs"
          >
            <ImageIcon className="h-4 w-4" />
          </button>
          <button
            type="submit"
            disabled={!body.trim()}
            className="h-11 w-11 rounded-full grid place-items-center
                       bg-white text-dark-blue disabled:opacity-40
                       transition active:scale-[0.95]"
            aria-label={t(lang, "chat_send")}
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------
// Single message row + reaction picker.

function ChatRow({
  message: m,
  mine,
  parent,
  reactionsOpen,
  onHoldStart,
  onHoldEnd,
  onReact,
  onReply,
  onDelete,
  lang,
}: {
  message: Message;
  mine: boolean;
  parent: Message | null;
  reactionsOpen: boolean;
  onHoldStart: () => void;
  onHoldEnd: () => void;
  onReact: (emoji: string) => void;
  onReply: () => void;
  onDelete: () => void;
  lang: "en" | "lt";
}) {
  const avatar = m.avatarId ? getAvatar(m.avatarId) : null;
  const isCard = m.kind === "bingo_strike";

  // Long-press: 450ms touchstart / mousedown → open the reaction picker.
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPress = () => {
    pressTimer.current = setTimeout(() => onHoldStart(), 450);
  };
  const cancelPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

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
        className={`relative max-w-[78%] sm:max-w-[68%] flex gap-2 ${
          mine ? "flex-row-reverse" : "flex-row"
        }`}
      >
        {/* Avatar — only on non-mine to save space. */}
        {!mine && (
          <div className="h-9 w-9 shrink-0 rounded-xl overflow-hidden ring-1 ring-white/10 bg-white/[0.04]">
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
          {!mine && (
            <span className="text-[11px] font-display text-white/55 truncate">
              {m.name}
            </span>
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

          <button
            type="button"
            onMouseDown={startPress}
            onMouseUp={cancelPress}
            onMouseLeave={cancelPress}
            onTouchStart={startPress}
            onTouchEnd={cancelPress}
            onTouchCancel={cancelPress}
            onContextMenu={(e) => e.preventDefault()}
            className={`relative text-left px-3.5 py-2 rounded-2xl text-sm leading-snug
                        transition active:scale-[0.99]
                        ${
                          isCard
                            ? "bg-flamingo/15 ring-1 ring-flamingo/40 text-white"
                            : mine
                              ? "bg-white text-dark-blue"
                              : "bg-white/[0.06] ring-1 ring-white/10 text-white/90"
                        }`}
          >
            {isCard ? (
              <BingoCardMessage meta={m.meta} />
            ) : m.gifUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={m.gifUrl}
                alt=""
                className="rounded-xl max-h-60"
              />
            ) : (
              <span className="whitespace-pre-wrap break-words">{m.body}</span>
            )}
          </button>

          {/* Reactions strip */}
          {Object.keys(m.reactions).length > 0 && (
            <div
              className={`flex flex-wrap gap-1 ${
                mine ? "self-end" : "self-start"
              }`}
            >
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

          {/* Long-press reaction picker */}
          <AnimatePresence>
            {reactionsOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.85, y: 6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.85, y: 6 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                className={`flex items-center gap-1 p-1.5 rounded-full
                            bg-black/70 ring-1 ring-white/10 backdrop-blur-md
                            ${mine ? "self-end" : "self-start"}`}
              >
                {REACTION_EMOJIS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => {
                      onReact(e);
                      onHoldEnd();
                    }}
                    className="h-8 w-8 rounded-full grid place-items-center
                               hover:bg-white/10 transition text-base"
                  >
                    {e}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    onReply();
                    onHoldEnd();
                  }}
                  className="h-8 w-8 rounded-full grid place-items-center
                             hover:bg-white/10 transition text-white/75"
                  aria-label={t(lang, "chat_reply")}
                >
                  <Reply className="h-4 w-4" />
                </button>
                {mine && (
                  <button
                    type="button"
                    onClick={() => {
                      onDelete();
                      onHoldEnd();
                    }}
                    className="h-8 w-8 rounded-full grid place-items-center
                               hover:bg-error/30 transition text-error"
                    aria-label={t(lang, "chat_delete")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.li>
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
