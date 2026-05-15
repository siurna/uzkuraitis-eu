"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Reply, Pencil, Copy, Trash2, Smile, Loader2, Mic, Music, Trophy, Plus, ChevronRight, Users,
} from "lucide-react";
import { getAvatar } from "@/lib/avatars";
import { optimizedSrc } from "@/lib/img";
import { getCountry, countryName } from "@/lib/countries";
import { countryColors } from "@/lib/country-colors";
import { HeartFlag } from "@/components/flag";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ChatBroadcastCard } from "@/components/chat-broadcast-cards";
import { useRoomTab } from "@/components/room-shell";
import { useCountryDeepDive } from "@/components/country-deep-dive";
import { useProfile, prefetchProfile } from "@/components/profile-sheet";
import { ensureSessionId } from "@/lib/use-identity";
import { useParticles } from "@/components/particle-layer";
import { TranslationBubble } from "@/components/translation-bubble";
import { BeginnerBubble } from "@/components/beginner-bubble";
import { ChatTriviaCard } from "@/components/chat-trivia-inline";
import { ChatPollCard } from "@/components/chat-poll-card";
import { FluentEmoji } from "@/components/fluent-emoji";
import { useTranslateEnabled } from "@/lib/translate-client";
import { useBeginnerEnabled } from "@/lib/beginner-client";
import { useSwipeToReply } from "@/lib/use-swipe-to-reply";
import { haptic } from "@/lib/haptics";
import { getTrope, type TropeIndex } from "@/lib/bingo-tropes";
import { t, tDyn } from "@/lib/i18n";

const EDIT_WINDOW_MS = 2 * 60 * 1000;

// ── draft TOP-10 ballot helpers (shared shape with vote-form's
// localStorage; the live event lets an already-mounted Vote tab pick up
// the change without a reload) ──────────────────────────────────────
const BALLOT_POINTS = [12, 10, 8, 7, 6, 5, 4, 3, 2, 1] as const;
type BSlot = { points: number; countryCode: string | null };

function readBallot(roomCode: string): BSlot[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(`uzk_ballot_${roomCode}`) ?? "null");
    if (Array.isArray(parsed) && parsed.length === 10) return parsed;
  } catch {
    /* corrupt draft */
  }
  return BALLOT_POINTS.map((p) => ({ points: p, countryCode: null }));
}

function writeBallot(roomCode: string, slots: BSlot[]) {
  try {
    localStorage.setItem(`uzk_ballot_${roomCode}`, JSON.stringify(slots));
  } catch {
    /* private mode */
  }
  window.dispatchEvent(new CustomEvent("uzk:ballot-changed"));
}

// Put `code` at slot `target`. If it's already on the ballot, that's a
// *move* — the picks between its old and new spot shift to close the gap.
// If it isn't, that's an *insert* — everything from `target` down slides
// one slot lower and whatever was last falls off.
function placeInBallot(slots: BSlot[], code: string, target: number): BSlot[] {
  const cur = slots.map((s) => s.countryCode);
  const from = cur.indexOf(code);
  if (from === target) return slots;
  let next: (string | null)[];
  if (from === -1) {
    next = [...cur.slice(0, target), code, ...cur.slice(target, 9)];
  } else {
    next = [...cur];
    next.splice(from, 1);
    next.splice(target, 0, code);
  }
  return slots.map((s, i) => ({ ...s, countryCode: next[i] ?? null }));
}

// The sheet behind the now-playing card's "+ TOP 10" button: your whole
// ballot, tap a spot to slot the on-stage country there.
function AddTopTenSheet({
  open,
  onClose,
  roomCode,
  code,
  lang,
}: {
  open: boolean;
  onClose: () => void;
  roomCode: string;
  code: string;
  lang: "en" | "lt";
}) {
  const [slots, setSlots] = useState<BSlot[]>([]);
  useEffect(() => {
    if (open) setSlots(readBallot(roomCode));
  }, [open, roomCode]);

  const country = getCountry(code);
  const here = slots.findIndex((s) => s.countryCode === code);

  const place = (target: number) => {
    if (target === here) {
      onClose();
      return;
    }
    const next = placeInBallot(slots, code, target);
    writeBallot(roomCode, next);
    onClose();
    // No toast — the now-playing card's badge flips to the new place,
    // that's confirmation enough.
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t(lang, "np_drawer_title", country ? countryName(code, lang) : code.toUpperCase())}
      sub={t(lang, "np_drawer_sub")}
    >
      <ol className="flex flex-col gap-1.5">
        {slots.map((s, i) => {
          const c = s.countryCode ? getCountry(s.countryCode) : null;
          const isHere = i === here;
          return (
            <li key={s.points}>
              <button
                type="button"
                onClick={() => place(i)}
                className={`w-full flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition transform-gpu active:scale-[0.99]
                            ${isHere ? "bg-flamingo/15 ring-1 ring-flamingo/35" : "glass-surface active:bg-white/[0.08]"}`}
              >
                <span className="h-8 w-8 shrink-0 rounded-lg grid place-items-center font-display text-sm tabular-nums bg-white/[0.07] ring-1 ring-white/12 text-white/80">
                  {s.points}
                </span>
                {c ? (
                  <span className="flex items-center gap-2 min-w-0">
                    <HeartFlag code={c.code} size="sm" />
                    <span className="truncate text-sm text-white/85">{countryName(c.code, lang)}</span>
                  </span>
                ) : (
                  <span className="text-sm text-white/35 italic">{t(lang, "np_empty")}</span>
                )}
                <span className="flex-1" />
                {isHere && (
                  <span className="text-[10px] uppercase tracking-wider text-flamingo font-display">
                    {t(lang, "np_drawer_here")}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </BottomSheet>
  );
}

// Quick-react row in the long-press menu — big colourful gradient
// circles, very Eurovision-fan energy: love it / haha / what the hell /
// yasss / no way / so bad it's good. Stored as the emoji glyph so the
// reaction strip below the message renders it directly.
const QUICK_REACTS: { emoji: string; bg: string }[] = [
  // ❤️ was a dark red→cherry that swallowed the 3D Fluent heart;
  // pulled the gradient up into flamingo pink so the glyph reads
  // against the chip instead of disappearing into it.
  { emoji: "❤️", bg: "from-[#ffafd1] to-[#ff5fa2]" }, // I love it
  { emoji: "😂", bg: "from-[#ffe35a] to-[#f0a400]" }, // haha
  { emoji: "🤯", bg: "from-[#cf8df7] to-[#7e2fe0]" }, // what the hell
  { emoji: "🙌", bg: "from-[#5fe3c0] to-[#0fae8a]" }, // yasss
  { emoji: "😱", bg: "from-[#62b3ff] to-[#1f6fe0]" }, // no way
  { emoji: "💀", bg: "from-[#d6dde9] to-[#828ea4]" }, // so bad it's good
];

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
  | "results"
  | "trivia"
  | "poll";

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

// Markdown + URL renderer for a single string segment.
// Supports **bold**, *italic*, __underline__ (non-greedy, no nesting),
// plus auto-linking of http(s):// URLs and bare www.* URLs. Returns a
// string when there's no markup, else an array of nodes.
const INLINE_RE =
  /\*\*([^*]+?)\*\*|\*([^*]+?)\*|__([^_]+?)__|(https?:\/\/[^\s<>"')\]]+|www\.[^\s<>"')\]]+)/g;

function renderInline(s: string): React.ReactNode {
  if (!s.includes("*") && !s.includes("__") && !/https?:\/\/|www\./.test(s)) {
    return s;
  }
  const parts: React.ReactNode[] = [];
  let last = 0;
  let k = 0;
  let m: RegExpExecArray | null;
  // Reset lastIndex — INLINE_RE is module-scoped + has /g, so reuse
  // between calls would skip ahead.
  INLINE_RE.lastIndex = 0;
  while ((m = INLINE_RE.exec(s))) {
    if (m.index > last) parts.push(s.slice(last, m.index));
    if (m[1] != null) parts.push(<strong key={k++}>{m[1]}</strong>);
    else if (m[2] != null) parts.push(<em key={k++}>{m[2]}</em>);
    else if (m[3] != null) parts.push(<u key={k++}>{m[3]}</u>);
    else if (m[4] != null) {
      // Strip trailing punctuation that's almost always sentence-ending
      // rather than part of the URL. Re-emit it as plain text so the
      // sentence reads naturally.
      let url = m[4];
      let tail = "";
      while (/[.,!?:;)]/.test(url[url.length - 1] ?? "")) {
        tail = url[url.length - 1] + tail;
        url = url.slice(0, -1);
      }
      const href = url.startsWith("http") ? url : `https://${url}`;
      parts.push(
        <a
          key={k++}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="underline decoration-flamingo/60 underline-offset-2 hover:decoration-flamingo break-all"
        >
          {url}
        </a>,
      );
      if (tail) parts.push(tail);
    }
    last = INLINE_RE.lastIndex;
  }
  if (parts.length === 0) return s;
  if (last < s.length) parts.push(s.slice(last));
  return parts;
}

// Render @mentions inside message text as highlighted tokens (+ inline
// **bold** / *italic*). Only known participant names count
// (case-insensitive, longest match wins).
function renderBody(text: string, names: string[]): React.ReactNode {
  if (!text.includes("@") || names.length === 0) return renderInline(text);
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
    out.push(<span key={key++}>{renderInline(text.slice(i, end))}</span>);
    i = end;
  }
  return out;
}

// Commentator (banter) renderer. Supports two leading-hash markdown
// flavours so the admin can structure each line as
//   "# Country" + newline + "## Artist" + newline + the line itself
// — they read as a small typographic hierarchy above the body line.
//
// Size hierarchy (bigger → smaller):
//   #  → text-xl  (the country / headline)
//   ## → text-base (the artist / subhead)
//   body → text-sm (inherited from the bubble)
//
// The LAST header in the leading block gets a chunkier margin-bottom
// so the body line has breathing room and the title block reads as
// "this is the setup". A header is "last" if every subsequent
// non-empty line is a body line (i.e., not another `# ` / `## `).
//
// Single-pass parse: split on newlines, prefix-match the hash flavours,
// fall through to renderInline for plain lines. The last-header
// detection is a separate forward scan; cheap, banter lines are short.
function renderBanter(text: string): React.ReactNode {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  // Find the last index that is a header line. Anything after it is
  // body / blanks; that header gets the bigger margin-bottom.
  let lastHeaderIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^#{1,2} /.test(lines[i].trimEnd())) lastHeaderIdx = i;
  }
  return (
    <span className="flex flex-col gap-0.5">
      {lines.map((raw, i) => {
        const line = raw.trimEnd();
        const headerTail = i === lastHeaderIdx ? "mb-2" : "";
        if (/^# (.+)$/.test(line)) {
          return (
            <span
              key={i}
              className={`block font-display text-xl leading-tight ${headerTail}`}
            >
              {renderInline(line.slice(2))}
            </span>
          );
        }
        if (/^## (.+)$/.test(line)) {
          return (
            <span
              key={i}
              className={`block font-display text-base leading-tight text-white/85 ${headerTail}`}
            >
              {renderInline(line.slice(3))}
            </span>
          );
        }
        if (line === "") {
          return <span key={i} className="block h-1" aria-hidden />;
        }
        return (
          <span key={i} className="block">
            {renderInline(line)}
          </span>
        );
      })}
    </span>
  );
}

export { renderBanter };

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
  nowPlayingCode,
  roomCode,
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
  /** The country currently on stage — its now-playing card's heart loops
   *  and gets the "+ TOP 10" shortcut (older now-playing cards don't). */
  nowPlayingCode: string | null;
  roomCode: string;
}) {
  const avatar = m.avatarId ? getAvatar(m.avatarId) : null;
  const isCard = m.kind === "bingo_strike";
  const isSystem = m.kind === "system";
  const isNowPlaying = m.kind === "now_playing";
  const isResults = m.kind === "results";
  const isTrivia = m.kind === "trivia";
  const isPoll = m.kind === "poll";
  const isMedia = (m.kind === "gif" || m.kind === "image") && m.gifUrl;
  // Emoji-only text messages get the iMessage / Telegram "jumbo
  // emoji" treatment: bigger glyphs, no bubble. Detection allows any
  // mix of emoji glyphs, ZWJ sequences, variation selectors and
  // whitespace; we cap at 8 visible glyphs so a wall of 50 hearts
  // doesn't tile the chat in 5-line giants.
  const jumboCount = (() => {
    if (m.kind !== "text" || !m.body) return 0;
    const trimmed = m.body.trim();
    if (!trimmed) return 0;
    if (!/^[\s\p{Extended_Pictographic}‍️]+$/u.test(trimmed)) return 0;
    // Count visible glyphs via Intl.Segmenter when available, else
    // fall back to a code-point split (over-counts ZWJ sequences but
    // still capped at 8 — close enough).
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Seg = (Intl as any).Segmenter;
      if (Seg) {
        const seg = new Seg(undefined, { granularity: "grapheme" });
        return Array.from(seg.segment(trimmed.replace(/\s+/g, ""))).length;
      }
    } catch {
      /* fall through */
    }
    return Array.from(trimmed.replace(/\s+/g, "")).length;
  })();
  const isJumbo = jumboCount > 0 && jumboCount <= 8;
  const jumboSize =
    jumboCount <= 1 ? "text-6xl" : jumboCount <= 3 ? "text-5xl" : "text-3xl";
  // A message that's pulled enough reactions glows — it's a "highlight".
  const reactionTotal = Object.values(m.reactions).reduce((n, r) => n + r.count, 0);
  // Polls already render the reaction count as a tally, so don't add
  // the highlight glow on top — it'd compete with the bar fill.
  const isHighlight = !isSystem && !isNowPlaying && !isResults && !isPoll && reactionTotal >= 5;
  const isEdited = (m.meta as { edited?: boolean } | null)?.edited === true;
  // Edit window: server enforces, but we ALSO tick a clock here so
  // the local Edit button disappears the moment the window closes
  // — without the ticker, an idle tab kept the affordance visible
  // until the next state change. 10-second cadence keeps the
  // re-render cost negligible while still expiring the button at
  // worst 10s late.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!mine || m.kind !== "text") return;
    const age = Date.now() - new Date(m.createdAt).getTime();
    if (age >= EDIT_WINDOW_MS) return;
    const id = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(id);
  }, [mine, m.kind, m.createdAt]);
  const canEdit =
    mine && m.kind === "text" &&
    now - new Date(m.createdAt).getTime() < EDIT_WINDOW_MS;

  const deepDive = useCountryDeepDive();
  const profile = useProfile();
  const particles = useParticles();
  const roomTab = useRoomTab();
  const translateOn = useTranslateEnabled();
  const beginnerOn = useBeginnerEnabled();
  const lastTap = useRef(0); // for double-tap-a-text-bubble → ❤️
  // Bot rows (the commentator) don't open a profile — there's no DB row
  // to look up. Real participants do.
  const isCommentator = !!m.meta?.commentator;
  const canOpenProfile = !mine && !isSystem && !isNowPlaying && !isResults && !isCommentator;
  // React + a little burst of that emoji floating up from the tap point.
  const reactWithRain = (e: { currentTarget: Element }, emoji: string) => {
    haptic(12);
    const r = e.currentTarget.getBoundingClientRect();
    const n = 5 + Math.floor(Math.random() * 3);
    particles.spawnMany(
      Array.from({ length: n }, () => ({
        asset: { type: "emoji" as const, glyph: emoji },
        from: {
          x: r.left + r.width / 2 + (Math.random() - 0.5) * (r.width * 0.8),
          y: r.top + r.height / 2,
        },
        driftRange: 90 + Math.random() * 50,
        size: 26 + Math.random() * 18,
        durationMs: 550 + Math.random() * 300,
        rotate: 24 + Math.random() * 22,
      })),
    );
    onReact(emoji);
  };
  const [addOpen, setAddOpen] = useState(false); // "+ TOP 10" sheet (now-playing card)
  const [reactorsOpen, setReactorsOpen] = useState(false); // "who reacted?" sheet
  // For the *active* now-playing card: where this country sits in your
  // draft TOP 10 (1-based), or null if it isn't on your ballot. Drives
  // the badge ("#3" vs "+ TOP 10"); re-reads on uzk:ballot-changed.
  const npCode = isNowPlaying ? (m.meta as { code?: string } | null)?.code ?? null : null;
  const npActive = !!npCode && npCode === nowPlayingCode;
  const [ballotPos, setBallotPos] = useState<number | null>(null);
  useEffect(() => {
    if (!npActive || !npCode) return;
    const read = () => {
      try {
        const slots = JSON.parse(localStorage.getItem(`uzk_ballot_${roomCode}`) ?? "null");
        const i = Array.isArray(slots)
          ? slots.findIndex((s: { countryCode?: string | null }) => s?.countryCode === npCode)
          : -1;
        setBallotPos(i >= 0 ? i + 1 : null);
      } catch {
        setBallotPos(null);
      }
    };
    read();
    window.addEventListener("uzk:ballot-changed", read);
    return () => window.removeEventListener("uzk:ballot-changed", read);
  }, [npActive, npCode, roomCode]);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longFired = useRef(false);
  const startPress = () => {
    if (isSystem || isNowPlaying || isResults) return;
    longFired.current = false;
    pressTimer.current = setTimeout(() => {
      longFired.current = true;
      onOpenMenu();
    }, 230);
  };
  const cancelPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };
  // Swipe-to-reply (own messages swipe left, incoming swipe right). A
  // recognised swipe cancels any pending long-press.
  const swipe = useSwipeToReply({ dir: mine ? -1 : 1, onCommit: onReply, onLock: cancelPress });

  // The long-press menu fans out above (reactions) and below (actions)
  // the bubble — make sure there's room for both by centring the message
  // when it opens.
  useEffect(() => {
    if (menuOpen) swipe.ref.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuOpen]);

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

  if (isPoll) {
    const pollMeta = m.meta as {
      poll?: boolean;
      question?: { en?: string; lt?: string };
      choices?: { emoji: string; en: string; lt: string }[];
    } | null;
    return (
      <motion.li
        initial={m.pending ? { opacity: 0, scale: 0.97 } : false}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="my-1 px-1"
      >
        <ChatPollCard
          messageId={m.id}
          meta={pollMeta}
          reactions={m.reactions}
          lang={lang}
        />
      </motion.li>
    );
  }

  if (isTrivia) {
    const triviaMeta = m.meta as {
      countryCode?: string;
      correctIndex?: number;
      firesAt?: string;
      en?: { question: string; choices: string[] };
      lt?: { question: string; choices: string[] };
    } | null;
    const cc = triviaMeta?.countryCode;
    if (!cc) return null;
    // The server now posts the trivia message AS SOON AS the country
    // goes live, but stamps `meta.firesAt` with a random ISO timestamp
    // 30s–3:30 in the future. Until that timestamp lands the row is
    // invisible (no motion.li, no card, no scroll-jump space taken).
    // <DelayedTrivia/> below schedules its own re-render at firesAt and
    // then renders the card. The chat-row index is preserved by id, so
    // when it appears it slots in at its original chat position.
    const snapshot =
      triviaMeta.correctIndex != null && triviaMeta.en && triviaMeta.lt
        ? {
            correctIndex: triviaMeta.correctIndex,
            en: triviaMeta.en,
            lt: triviaMeta.lt,
          }
        : null;
    return (
      <DelayedTrivia firesAt={triviaMeta.firesAt ?? null}>
        <motion.li
          initial={m.pending ? { opacity: 0, scale: 0.97 } : false}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="my-5 px-1"
        >
          <ChatTriviaCard
            countryCode={cc}
            snapshot={snapshot}
            roomCode={roomCode}
            lang={lang}
            // When admin advances past this country, freeze the card —
            // players shouldn't be able to answer trivia about whoever
            // was on stage 5 minutes ago.
            isOnStage={cc === nowPlayingCode}
          />
        </motion.li>
      </DelayedTrivia>
    );
  }

  if (isResults) {
    const podium = ((m.meta as { podium?: { name: string; total: number }[] } | null)?.podium ?? []).slice(0, 3);
    const medals = ["🥇", "🥈", "🥉"];
    // Bar widths scale relative to the #1's score so the eye can read
    // "how close are 2nd/3rd to the leader" without doing math.
    const top = podium[0]?.total ?? 1;
    const widthFor = (n: number) =>
      `${Math.max(20, Math.min(100, (n / top) * 100))}%`;
    // "Your breakdown" makes no sense if you didn't cast a ballot;
    // disable it. Local-only check via the localStorage flag the vote
    // form sets.
    const hasVoted =
      typeof window !== "undefined" &&
      window.localStorage.getItem(`uzk_voted_${roomCode}`) === "1";
    return (
      <motion.li
        initial={m.pending ? { opacity: 0, scale: 0.97 } : false}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="my-1 px-1"
      >
        {/* Thicker turquoise border (ring-[3px]) so the card reads as a
            clear "Big Deal among the surrounding chatter" frame.
            Gradient is intentionally calmer than the earlier
            turquoise → indigo → flamingo rainbow: a single deep
            teal-to-indigo wash with a subtle plum closing note. Less
            visual noise behind the leaderboard bars. */}
        <div className="rounded-3xl ring-[3px] ring-turquoise/75 shadow-[0_18px_44px_-18px_oklch(70%_0.15_190_/_0.55)] overflow-hidden">
          <div
            className="relative overflow-hidden p-5 flex flex-col gap-4
                       shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]"
            style={{
              background:
                "linear-gradient(140deg, #006a73 0%, #142255 55%, #261545 100%)",
            }}
          >
            <header className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-yellow" fill="currentColor" />
              <p className="text-[10px] uppercase tracking-[0.3em] text-white/90 font-display leading-tight">
                {t(lang, "home_results")}
              </p>
            </header>

            {podium.length > 0 ? (
              <ol className="flex flex-col gap-2">
                {podium.map((p, i) => (
                  <li key={i} className="relative">
                    <div className="flex items-center gap-2 mb-1">
                      <FluentEmoji glyph={medals[i]} size={18} className="shrink-0" />
                      {/* Bigger name as the user asked: text-base
                          (was text-sm) + drop-shadow for legibility on
                          the gradient bar that sits behind it. */}
                      <span className="font-display text-base text-white truncate flex-1 drop-shadow-sm">
                        {p.name}
                      </span>
                    </div>
                    <div className="relative h-7 rounded-lg overflow-hidden bg-white/15">
                      <motion.div
                        className={`absolute inset-y-0 left-0 rounded-lg
                                    ${
                                      i === 0
                                        ? "bg-gradient-to-r from-yellow to-orange shadow-[0_0_18px_rgba(245,163,2,0.5)]"
                                        : i === 1
                                          ? "bg-white/55"
                                          : "bg-orange/60"
                                    }`}
                        initial={{ width: 0 }}
                        animate={{ width: widthFor(p.total) }}
                        transition={{ duration: 0.7, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                      />
                      {/* Score lives ON the bar — embedded in the chip
                          itself rather than floating to the right, so
                          the bar's width carries the "how far ahead"
                          signal cleanly. */}
                      <span className="absolute inset-y-0 right-2 flex items-center font-display tabular-nums text-sm text-white drop-shadow-sm">
                        {p.total}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-white/85">{m.body}</p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => hasVoted && roomTab.setTab("vote")}
                disabled={!hasVoted}
                className={`flex-1 h-10 rounded-xl font-display text-sm transition flex items-center justify-center gap-1.5
                            ${
                              hasVoted
                                ? "bg-white text-dark-blue active:scale-[0.98]"
                                : "bg-white/20 text-white/45 cursor-not-allowed"
                            }`}
                title={hasVoted ? undefined : t(lang, "sys_cta_results_breakdown_disabled")}
              >
                {t(lang, "sys_cta_results_breakdown")}
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  roomTab.setTab("vote");
                  window.dispatchEvent(
                    new CustomEvent("uzk:results-tab", { detail: "board" }),
                  );
                }}
                className="flex-1 h-10 rounded-xl bg-white/15 ring-1 ring-white/25 text-white font-display text-sm
                           active:scale-[0.98] transition flex items-center justify-center gap-1.5"
              >
                {t(lang, "sys_cta_results_board")}
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </motion.li>
    );
  }

  if (isNowPlaying) {
    const cc = (m.meta as { code?: string } | null)?.code;
    const country = cc ? getCountry(cc) : null;
    const [c1, c2] = countryColors(cc ?? "");
    const isActive = !!cc && cc === nowPlayingCode;
    return (
      <motion.li
        initial={m.pending ? { opacity: 0, scale: 0.97 } : false}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="my-1"
      >
        <div
          className="p-[2px] rounded-2xl"
          style={{ background: `linear-gradient(120deg, ${c1}, ${c2})` }}
        >
          <div className="flex items-start gap-3 rounded-[14px] bg-dark-blue-900/88 px-4 py-3">
            {country ? (
              <span className={`shrink-0 ${isActive ? "heartbeat-loop" : ""}`}>
                <HeartFlag code={country.code} size="md" />
              </span>
            ) : (
              <Smile className="h-5 w-5 text-flamingo shrink-0 mt-0.5" />
            )}
            <button
              type="button"
              disabled={!country}
              onClick={() => country && deepDive.open(country.code)}
              className="min-w-0 flex-1 text-left disabled:cursor-default"
            >
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
                      <Mic className="h-3 w-3 text-dark-blue-200" />
                      {country.artist}
                    </span>
                  )}
                  {country?.song && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.07] ring-1 ring-white/12 px-2 py-0.5 text-[11px] italic text-white/70">
                      <Music className="h-3 w-3 text-dark-blue-200" />
                      {country.song}
                    </span>
                  )}
                </div>
              )}
            </button>
            <div className="flex flex-col items-end gap-2 shrink-0">
              <span className="text-[10px] text-white/30 tabular-nums">{time}</span>
              {country && isActive && (
                ballotPos != null ? (
                  <button
                    type="button"
                    onClick={() => setAddOpen(true)}
                    aria-label={t(lang, "chat_np_my_rank_aria", ballotPos)}
                    className="inline-flex items-center justify-center h-8 px-2.5 rounded-full
                               bg-white/18 ring-1 ring-white/30 text-white font-display text-xs tabular-nums
                               active:scale-95 transition transform-gpu"
                  >
                    {t(lang, "chat_np_my_rank", ballotPos)}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAddOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white text-dark-blue
                               px-3 h-8 font-display text-xs leading-none shadow-sm
                               active:scale-95 transition transform-gpu"
                  >
                    <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                    {t(lang, "np_add_top10")}
                  </button>
                )
              )}
            </div>
          </div>
        </div>
        {country && isActive && (
          <AddTopTenSheet
            open={addOpen}
            onClose={() => setAddOpen(false)}
            roomCode={roomCode}
            code={country.code}
            lang={lang}
          />
        )}
      </motion.li>
    );
  }

  if (isSystem) {
    const sys = (m.meta ?? null) as {
      sysKey?: string;
      sysArg?: string | null;
      codes?: string[];
    } | null;
    const isCta = !!sys?.sysKey && sys.sysKey.startsWith("sys_cta_");
    if (isCta) {
      // Each host CTA gets a tailored card in chat-broadcast-cards.tsx.
      // The cards wrap themselves in `rainbow-border` + are full-width;
      // we just give them an `<li>` slot here.
      return (
        <motion.li
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="px-1"
        >
          <ChatBroadcastCard meta={sys} lang={lang} messageId={m.id} />
        </motion.li>
      );
    }
    // Non-CTA system lines (someone voted, show transitions) stay as
    // the tiny muted pill — they're meta-narration, not a host shout.
    const text = sys?.sysKey ? tDyn(lang, sys.sysKey, sys.sysArg ?? undefined) : m.body;
    return (
      <motion.li initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-center">
        <span className="text-[11px] text-white/40 px-3 py-1 rounded-full bg-white/[0.03]">{text}</span>
      </motion.li>
    );
  }

  return (
    // Plain <li>, NOT motion.li. The long-press menu's .glass-card
    // surface fails on iOS Safari any time an ancestor has a
    // transform — and motion injects `transform: translate(0, 0)` on
    // any element with a motion property even at rest. Pending
    // messages get a fade-in via the .uzk-msg-fade CSS keyframe,
    // which is opacity-only and never touches transform.
    <li
      data-msg-id={m.id}
      className={`flex ${mine ? "justify-end" : "justify-start"} ${m.pending ? "uzk-msg-fade" : ""}`}
    >
      <div className={`relative max-w-[82%] sm:max-w-[68%] flex gap-2 ${mine ? "flex-row-reverse" : "flex-row"}`}>
        {!mine && (
          // Tap the avatar to open the author's profile. The commentator
          // bot doesn't have a real profile, so it stays a plain tile.
          (() => {
            const avatarInner =
              m.meta && typeof m.meta.commentatorPhoto === "string" && m.meta.commentatorPhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={optimizedSrc(m.meta.commentatorPhoto, 96)} alt="" className="h-full w-full object-cover" />
              ) : isCommentator ? (
                <div className="h-full w-full grid place-items-center">
                  <FluentEmoji glyph="🎙️" size={20} />
                </div>
              ) : avatar?.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={optimizedSrc(avatar.photo, 128)}
                  alt=""
                  className="h-full w-full object-cover"
                  style={{ objectPosition: avatar.focal ? `${avatar.focal.x}% ${avatar.focal.y}%` : "50% 30%" }}
                />
              ) : (
                <div className="h-full w-full grid place-items-center text-xs font-display text-white/45">
                  {m.name.charAt(0).toUpperCase()}
                </div>
              );
            const cls = `h-9 w-9 shrink-0 rounded-xl overflow-hidden ring-1 ring-white/10 bg-white/[0.04] ${showHeader ? "" : "invisible"}`;
            if (canOpenProfile) {
              return (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    profile.open(m.sessionId, { name: m.name, avatarId: m.avatarId ?? null });
                  }}
                  // Prefetch the profile the moment the finger lands so
                  // the response races the drawer's 280ms slide-up.
                  onPointerDown={() =>
                    prefetchProfile(roomCode, m.sessionId, ensureSessionId())
                  }
                  aria-label={m.name}
                  className={`${cls} hover:ring-white/30 active:scale-[0.95] transition transform-gpu`}
                >
                  {avatarInner}
                </button>
              );
            }
            return <div className={cls}>{avatarInner}</div>;
          })()
        )}

        <div className={`min-w-0 flex flex-col gap-1 ${mine ? "items-end" : "items-start"}`}>
          {showHeader && !mine && (
            <span className="text-[11px] font-display text-white/55 truncate flex items-center gap-1.5">
              {m.name}
              <span className="text-white/30 tabular-nums">{time}</span>
            </span>
          )}
          {showHeader && mine && (
            <span className="text-[11px] text-white/35 tabular-nums self-end">{time}</span>
          )}

          {m.replyTo && (
            // Quoted-message chip — reads as part of the bubble below.
            // Falls back to a "(deleted)" italic when the parent has
            // been removed or scrolled out of the rendered window so
            // the reply doesn't silently lose its context cue.
            <div
              className={`text-[11px] px-3 py-1.5 rounded-xl truncate max-w-[min(100%,18rem)] ${
                mine ? "self-end" : "self-start"
              } ${
                mine
                  ? "bg-white text-dark-blue/85 ring-1 ring-flamingo/30 shadow-[inset_2px_0_0_oklch(70%_0.27_336)]"
                  : "bg-white/[0.04] ring-1 ring-white/10 text-white/65 shadow-[inset_2px_0_0_oklch(70%_0.27_336)]"
              }`}
            >
              <Reply className="h-3 w-3 inline-block mr-1 text-flamingo" />
              {parent ? (
                <>
                  <span className={`font-display ${mine ? "text-dark-blue" : "text-white/85"}`}>
                    {parent.name}
                  </span>
                  {": "}
                  {parent.body ?? (parent.gifUrl ? "GIF" : t(lang, "chat_card"))}
                </>
              ) : (
                <span className="italic opacity-70">{t(lang, "chat_reply_deleted")}</span>
              )}
            </div>
          )}

          <div className="relative">
            {/* The reply arrow — fades in only as you swipe. */}
            <span
              ref={swipe.arrowRef}
              aria-hidden
              style={{ opacity: 0 }}
              className={`pointer-events-none absolute inset-y-0 grid place-items-center text-flamingo
                          ${mine ? "right-1" : "left-1"}`}
            >
              <Reply className="h-4 w-4" />
            </span>
            <button
              ref={swipe.ref}
              type="button"
              onPointerDown={(e) => {
                swipe.handlers.onPointerDown(e);
                startPress();
              }}
              onPointerMove={swipe.handlers.onPointerMove}
              onPointerUp={(e) => {
                swipe.handlers.onPointerUp(e);
                cancelPress();
              }}
              onPointerCancel={(e) => {
                swipe.handlers.onPointerCancel(e);
                cancelPress();
              }}
              onPointerLeave={cancelPress}
              onClick={(e) => {
                // After a long-press the menu's already open, and after a
                // swipe the bubble just snapped back — swallow the trailing
                // click so it doesn't open the lightbox / bubble to the
                // list's "tap-empty-space-to-close" handler.
                if (longFired.current || swipe.swipedRef.current) {
                  longFired.current = false;
                  swipe.swipedRef.current = false;
                  e.stopPropagation();
                  return;
                }
                if (isMedia && m.gifUrl) {
                  onOpenImage(m.gifUrl);
                  return;
                }
                // Double-tap a plain message → ❤️ it (Instagram-style:
                // only adds, never un-likes on re-double-tap).
                if (m.kind === "text") {
                  const now = Date.now();
                  if (now - lastTap.current < 320) {
                    lastTap.current = 0;
                    if (!m.reactions["❤️"]?.mine) reactWithRain(e, "❤️");
                  } else {
                    lastTap.current = now;
                  }
                }
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                longFired.current = true;
                onOpenMenu();
              }}
              // touch-pan-y (not touch-none) so a vertical drag still
              // scrolls the list when it starts on a bubble; we claim the
              // horizontal for swipe-to-reply. transition-colors only —
              // the swipe writes its own inline transform/transition.
              className={`relative text-left rounded-2xl text-sm leading-snug transition-colors touch-pan-y cursor-pointer overflow-hidden will-change-transform
                          ${isMedia ? "p-0" : isJumbo ? "px-1 py-1" : "px-3.5 py-2"}
                          ${
                            isCard
                              ? "bg-flamingo/15 ring-1 ring-flamingo/40 text-white px-3.5 py-2"
                              : isJumbo
                                ? "bg-transparent text-white"
                                : mine
                                  ? "bg-white text-dark-blue"
                                  : "bg-white/[0.06] ring-1 ring-white/10 text-white/90"
                          } ${m.pending ? "opacity-75" : ""} ${
                            isHighlight && !isJumbo
                              ? "ring-2 ring-flamingo/45 shadow-[0_4px_28px_-2px_oklch(70%_0.27_336_/_0.45)]"
                              : ""
                          }`}
            >
              {isCard ? (
                <BingoCardMessage meta={m.meta} lang={lang} />
              ) : isMedia ? (
                <span className="relative block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={m.gifUrl!}
                    alt=""
                    onLoad={() => window.dispatchEvent(new Event("uzk:chat-media-loaded"))}
                    // `touch-manipulation` blocks iOS Safari's native
                    // double-tap-to-zoom on the image so the bubble's
                    // own click + double-tap-to-react handlers run.
                    // `aspect-ratio: auto 4 / 3` falls back to 4/3 only
                    // before the natural ratio is known — once the
                    // image decodes the browser swaps to the real one.
                    // (Without `auto`, the ratio would override the
                    // intrinsic dimensions and squish every GIF.)
                    style={{ aspectRatio: "auto 4 / 3" }}
                    className="block max-h-60 w-auto rounded-2xl touch-manipulation"
                    draggable={false}
                  />
                  {m.kind === "image" && m.pending && (
                    <span className="absolute inset-0 grid place-items-center bg-black/30 rounded-2xl">
                      <Loader2 className="h-5 w-5 text-white animate-spin" />
                    </span>
                  )}
                </span>
              ) : (
                <>
                  <span
                    className={`whitespace-pre-wrap break-words ${
                      isJumbo ? `${jumboSize} leading-none tracking-wide` : ""
                    }`}
                  >
                    {/* Commentator bodies route through the banter
                        renderer so the admin's `# Country` /
                        `## Artist` hierarchy reads as light headers
                        above the line. Regular chat stays on the
                        mention-aware renderer. */}
                    {isCommentator
                      ? renderBanter(m.body ?? "")
                      : renderBody(m.body ?? "", participantNames)}
                  </span>
                  {isEdited && (
                    <span className="text-[10px] opacity-50 ml-1.5">({t(lang, "chat_edited")})</span>
                  )}
                </>
              )}
            </button>

            {/* Long-press menu, rendered INLINE (not portaled). The
                portal version was scroll-jankily re-measuring the
                bubbleRect on every scroll event. Glass effect ditched
                for a deep blue gradient with a soft white inset — no
                backdrop-filter dependency, no iOS Safari quirks, no
                re-measure cost. */}
            <AnimatePresence>
              {menuOpen && (
                <>
                  <motion.div
                    key="reacts"
                    initial={{ opacity: 0, scale: 0.85, y: 8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 6 }}
                    transition={{ type: "spring", stiffness: 900, damping: 30, mass: 0.4 }}
                    onClick={(e) => e.stopPropagation()}
                    className={`absolute bottom-full mb-2 z-30 ${mine ? "right-0" : "left-0"}`}
                  >
                    <div className="flex items-center gap-2 p-2 rounded-full bg-black/85 ring-1 ring-white/12 shadow-xl">
                      {QUICK_REACTS.map(({ emoji, bg }, i) => {
                        const picked = !!m.reactions[emoji]?.mine;
                        const anyPicked = Object.values(m.reactions).some((r) => r.mine);
                        const showGray = anyPicked && !picked;
                        return (
                          <motion.button
                            key={emoji}
                            type="button"
                            onClick={(e) => reactWithRain(e, emoji)}
                            initial={{ scale: 0.4, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.4, opacity: 0 }}
                            transition={{ delay: i * 0.012, duration: 0.05, ease: "easeOut" }}
                            className={`relative h-11 w-11 shrink-0 rounded-full grid place-items-center text-xl leading-none
                                        bg-gradient-to-br ${bg}
                                        shadow-[0_4px_12px_-3px_rgba(0,0,0,0.55)] transition-transform active:scale-90
                                        ${
                                          picked
                                            ? "ring-2 ring-flamingo brightness-110"
                                            : showGray
                                              ? "ring-1 ring-white/20 grayscale opacity-65 hover:opacity-100 hover:grayscale-0"
                                              : "ring-1 ring-white/20"
                                        }`}
                          >
                            <FluentEmoji glyph={emoji} size={26} className="drop-shadow-[0_1px_1px_rgba(0,0,0,0.25)]" />
                            {picked && (
                              <span
                                className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-flamingo ring-2 ring-black/80"
                                aria-hidden
                              />
                            )}
                          </motion.button>
                        );
                      })}
                    </div>
                  </motion.div>
                  <motion.div
                    key="actions"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.14 }}
                    onClick={(e) => e.stopPropagation()}
                    className={`absolute top-full mt-2 z-30 ${mine ? "right-0" : "left-0"}`}
                  >
                    {/* Deep blue gradient + a thin white inset for the
                        hairline of light. No backdrop-filter, no
                        re-measure cost. Reads close enough to the old
                        glass that the loss is in colour-richness only,
                        and we gain back smooth scroll while the menu
                        is open. */}
                    <div
                      className="rounded-2xl overflow-hidden min-w-[10.5rem] flex flex-col ring-1 ring-white/12"
                      style={{
                        background:
                          "linear-gradient(180deg, oklch(28% 0.06 264 / 0.94) 0%, oklch(16% 0.06 264 / 0.96) 100%)",
                        boxShadow:
                          "inset 0 1px 0 rgba(255,255,255,0.10), 0 14px 36px -14px rgba(0,0,0,0.6)",
                      }}
                    >
                      <MenuAction onClick={onReply} icon={Reply} label={t(lang, "chat_reply")} />
                      {reactionTotal > 0 && (
                        <MenuAction
                          onClick={() => setReactorsOpen(true)}
                          icon={Users}
                          label={t(lang, "chat_who_reacted")}
                        />
                      )}
                      {canEdit && <MenuAction onClick={onEdit} icon={Pencil} label={t(lang, "chat_edit")} />}
                      {m.body && <MenuAction onClick={onCopy} icon={Copy} label={t(lang, "chat_copy")} />}
                      {mine && <MenuAction onClick={onDelete} icon={Trash2} label={t(lang, "chat_delete")} danger />}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          {/* Auto-translate + beginner-gloss bubbles fade in/out when
              their settings flip. AnimatePresence wraps each one so
              toggling the setting in the drawer doesn't snap a bunch
              of bubbles into existence across the visible thread —
              they ease in (and ease out when turned off) as the user
              expects from a chat companion-feature. */}
          <AnimatePresence initial={false}>
            {translateOn && !mine && m.kind === "text" && m.body && (
              <motion.div
                key="translate"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                style={{ overflow: "hidden" }}
              >
                <TranslationBubble text={m.body} mine={mine} />
              </motion.div>
            )}
            {beginnerOn && !translateOn && !mine && m.kind === "text" && m.body && (
              <motion.div
                key="beginner"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                style={{ overflow: "hidden" }}
              >
                <BeginnerBubble text={m.body} lang={lang} mine={mine} />
              </motion.div>
            )}
          </AnimatePresence>

          {Object.keys(m.reactions).length > 0 && (
            <div className={`flex flex-wrap items-center gap-1 ${mine ? "self-end" : "self-start"}`}>
              {Object.entries(m.reactions).map(([emoji, info]) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={(e) => (info.mine ? onReact(emoji) : reactWithRain(e, emoji))}
                  title={info.names.join(", ")}
                  className={`pl-1.5 pr-2 h-6 rounded-full text-xs font-display inline-flex items-center gap-1 transition
                              ${
                                info.mine
                                  ? "bg-flamingo/25 ring-1 ring-flamingo/45 text-white"
                                  : "bg-white/[0.06] ring-1 ring-white/10 text-white/80 hover:bg-white/[0.10]"
                              }`}
                >
                  <FluentEmoji glyph={emoji} size={16} />
                  <span className="tabular-nums">{info.count}</span>
                </button>
              ))}
            </div>
          )}

          <BottomSheet
            open={reactorsOpen}
            onClose={() => setReactorsOpen(false)}
            title={t(lang, "chat_reactors_title")}
          >
            <ul className="flex flex-col gap-3">
              {Object.entries(m.reactions).map(([emoji, info]) => (
                <li
                  key={emoji}
                  className="flex items-center gap-3 rounded-2xl glass-surface px-4 py-3"
                >
                  {/* Emoji + its count stack — count sits directly under
                      the glyph so the "how many" reads at a glance. */}
                  <div className="flex flex-col items-center shrink-0">
                    <FluentEmoji glyph={emoji} size={28} />
                    <span className="text-[11px] font-display text-white/55 tabular-nums mt-0.5">
                      {info.count}
                    </span>
                  </div>
                  <p className="min-w-0 flex-1 text-sm text-white/85 leading-snug break-words">
                    {info.names.join(", ")}
                  </p>
                </li>
              ))}
            </ul>
          </BottomSheet>

          {mine && seenBy > 0 && (
            <span className="text-[10px] text-white/35 self-end">
              {t(lang, "chat_seen_by", seenBy)}
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

// Trivia firesAt gate. The server stamps each trivia message with a
// random firesAt 30s–3:30 after the country goes live; this wrapper
// renders nothing until that timestamp arrives, then mounts its
// children. Pure timer + state — no broadcast involvement.
function DelayedTrivia({
  firesAt,
  children,
}: {
  firesAt: string | null;
  children: React.ReactNode;
}) {
  const target = firesAt ? Date.parse(firesAt) : 0;
  const [ready, setReady] = useState(() => !target || target <= Date.now());
  useEffect(() => {
    if (ready) return;
    const delay = target - Date.now();
    if (delay <= 0) {
      setReady(true);
      return;
    }
    const id = window.setTimeout(() => setReady(true), delay);
    return () => window.clearTimeout(id);
  }, [target, ready]);
  if (!ready) return null;
  return <>{children}</>;
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

function BingoCardMessage({ meta, lang }: { meta: Record<string, unknown> | null; lang: "en" | "lt" }) {
  const idx = meta?.tropeIndex;
  const trope =
    typeof idx === "number" ? getTrope(idx as TropeIndex, lang) : ((meta?.trope as string) ?? "");
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
