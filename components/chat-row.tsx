"use client";

import { useMemo, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Reply, Pencil, Copy, Trash2, Smile, Loader2, X, Mic, Music, Trophy } from "lucide-react";
import { getAvatar } from "@/lib/avatars";
import { getCountry, countryName } from "@/lib/countries";
import { HeartFlag } from "@/components/flag";
import { useCountryDeepDive } from "@/components/country-deep-dive";
import { t } from "@/lib/i18n";

const EDIT_WINDOW_MS = 2 * 60 * 1000;
const REACTION_EMOJIS = ["❤️", "🔥", "😂", "😮", "🎤", "💯"] as const;

export type Reactions = Record<
  string,
  { count: number; names: string[]; mine: boolean }
>;

export type MessageKind =
  | "text"
  | "gif"
  | "image"
  | "bingo_strike"
  | "system"
  | "now_playing"
  | "results";

export type Message = {
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
        out.push(<span key={key++} className="text-flamingo font-display">@{hit}</span>);
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

// ─────────────────────────────────────────────────────────────────────
// Single message row. Handles all kinds: now-playing banner, system
// pill, bingo card, GIF/image, and plain text — plus swipe-to-reply,
// long-press menu, reactions strip and the "seen by N" footer.

export function ChatRow({
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
  const isResults = m.kind === "results";
  const isMedia = (m.kind === "gif" || m.kind === "image") && m.gifUrl;
  const isEdited = (m.meta as { edited?: boolean } | null)?.edited === true;
  const canEdit =
    mine && m.kind === "text" &&
    Date.now() - new Date(m.createdAt).getTime() < EDIT_WINDOW_MS;

  const deepDive = useCountryDeepDive();
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longFired = useRef(false);
  const startPress = () => {
    if (isSystem || isNowPlaying || isResults) return;
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

  if (isResults) {
    const podium = ((m.meta as { podium?: { name: string; total: number }[] } | null)?.podium ?? []).slice(0, 3);
    const medals = ["🥇", "🥈", "🥉"];
    return (
      <motion.li
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="my-1"
      >
        <div className="rainbow-border rounded-2xl">
          <div className="rounded-[14px] bg-dark-blue-900/85 px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.3em] text-gold font-display leading-tight flex items-center gap-1.5">
              <Trophy className="h-3 w-3" />
              {t(lang, "home_results")}
            </p>
            <ol className="mt-2 flex flex-col gap-1">
              {podium.length > 0 ? (
                podium.map((p, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <span className="text-base shrink-0">{medals[i] ?? "•"}</span>
                    <span className="font-display text-white truncate flex-1">{p.name}</span>
                    <span className="tabular-nums text-white/70 shrink-0">{p.total}</span>
                  </li>
                ))
              ) : (
                <li className="text-sm text-white/60">{m.body}</li>
              )}
            </ol>
          </div>
        </div>
      </motion.li>
    );
  }

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
        <button
          type="button"
          disabled={!country}
          onClick={() => country && deepDive.open(country.code)}
          className="block w-full text-left rainbow-border rounded-2xl disabled:cursor-default"
        >
          <div className="flex items-start gap-3 rounded-[14px] bg-dark-blue-900/85 px-4 py-3">
            {country ? (
              <span className="heartbeat shrink-0">
                <HeartFlag code={country.code} size="md" />
              </span>
            ) : (
              <Smile className="h-5 w-5 text-flamingo shrink-0 mt-0.5" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-[0.3em] text-flamingo font-display leading-tight">
                {t(lang, "now_playing")}
              </p>
              <p className="text-sm font-display text-white truncate">
                {country ? countryName(country.code, lang) : (cc ?? "").toUpperCase()}
              </p>
              {(country?.artist || country?.song) && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {country?.artist && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.07] ring-1 ring-white/12 px-2 py-0.5 text-[11px] text-white/85">
                      <Mic className="h-3 w-3 text-white/55" />
                      {country.artist}
                    </span>
                  )}
                  {country?.song && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.07] ring-1 ring-white/12 px-2 py-0.5 text-[11px] italic text-white/70">
                      <Music className="h-3 w-3 text-white/45" />
                      {country.song}
                    </span>
                  )}
                </div>
              )}
            </div>
            <span className="text-[10px] text-white/30 tabular-nums shrink-0">{time}</span>
          </div>
        </button>
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
              onClick={(e) => {
                // After a long-press the menu is already open; swallow the
                // trailing click so it doesn't bubble to the list's
                // "tap-empty-space-to-close" handler.
                if (longFired.current) {
                  longFired.current = false;
                  e.stopPropagation();
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
