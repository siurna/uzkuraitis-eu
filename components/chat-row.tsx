"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Reply, Pencil, Copy, Trash2, Smile, Loader2, Mic, Music, Trophy, Plus,
} from "lucide-react";
import { getAvatar } from "@/lib/avatars";
import { optimizedSrc } from "@/lib/img";
import { getCountry, countryName } from "@/lib/countries";
import { countryColors } from "@/lib/country-colors";
import { HeartFlag } from "@/components/flag";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { useCountryDeepDive } from "@/components/country-deep-dive";
import { useParticles } from "@/components/particle-layer";
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
                            ${isHere ? "bg-flamingo/15 ring-1 ring-flamingo/35" : "bg-white/[0.04] ring-1 ring-white/8 active:bg-white/[0.08]"}`}
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
  { emoji: "❤️", bg: "from-[#ff6a86] to-[#e0123f]" }, // I love it
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

// Inline **bold** / *italic* / __underline__ (non-greedy, no nesting).
// Returns a string when there's no markup, else an array of nodes.
function renderInline(s: string): React.ReactNode {
  if (!s.includes("*") && !s.includes("__")) return s;
  const parts: React.ReactNode[] = [];
  const re = /\*\*([^*]+?)\*\*|\*([^*]+?)\*|__([^_]+?)__/g;
  let last = 0;
  let k = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m.index > last) parts.push(s.slice(last, m.index));
    if (m[1] != null) parts.push(<strong key={k++}>{m[1]}</strong>);
    else if (m[2] != null) parts.push(<em key={k++}>{m[2]}</em>);
    else parts.push(<u key={k++}>{m[3]}</u>);
    last = re.lastIndex;
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

// ── swipe-to-reply ───────────────────────────────────────────────────
// A hand-rolled horizontal drag: the bubble follows the finger (reply
// direction only) up to a cap; releasing past the threshold fires the
// reply. We pick "horizontal swipe vs. vertical scroll" from the first
// few px of travel and lock it, so list scrolling stays buttery and the
// bubble never jitters. `touch-action: pan-y` on the element keeps the
// browser from claiming horizontal pans. All movement is written to the
// DOM directly — no React re-renders per pointermove.
const SWIPE_CAP = 64;
const SWIPE_COMMIT = 40;

function useSwipeToReply({
  dir,
  onCommit,
  onLock,
}: {
  /** +1 = incoming message (swipe right), -1 = own message (swipe left). */
  dir: 1 | -1;
  onCommit: () => void;
  /** Fires once the gesture is recognised as a horizontal swipe. */
  onLock: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const arrowRef = useRef<HTMLSpanElement>(null);
  const swipedRef = useRef(false);
  const st = useRef<{ id: number; x0: number; y0: number; v: number; axis: "" | "h" | "v" } | null>(null);

  const paint = (v: number) => {
    const el = ref.current;
    if (el) {
      el.style.transition = "none";
      el.style.transform = v === 0 ? "" : `translate3d(${v}px,0,0)`;
    }
    const a = arrowRef.current;
    if (a) a.style.opacity = String(Math.min(1, Math.abs(v) / SWIPE_COMMIT));
  };
  const release = (commit: boolean) => {
    const el = ref.current;
    if (el) {
      el.style.transition = "transform 240ms cubic-bezier(0.22,1,0.36,1)";
      el.style.transform = "";
      window.setTimeout(() => { if (el) el.style.transition = ""; }, 280);
    }
    const a = arrowRef.current;
    if (a) { a.style.transition = "opacity 220ms"; a.style.opacity = "0"; }
    if (commit) onCommit();
  };

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button > 0) return;
    swipedRef.current = false;
    st.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, v: 0, axis: "" };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const s = st.current;
    if (!s || e.pointerId !== s.id) return;
    const dx = e.clientX - s.x0;
    const dy = e.clientY - s.y0;
    if (s.axis === "") {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      s.axis = Math.abs(dx) > Math.abs(dy) + 2 ? "h" : "v";
      if (s.axis === "h") {
        swipedRef.current = true;
        onLock();
        try { ref.current?.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      }
    }
    if (s.axis !== "h") return;
    let v = dir === 1 ? Math.max(0, dx) : Math.min(0, dx);
    if (Math.abs(v) > SWIPE_CAP) v = dir * (SWIPE_CAP + (Math.abs(v) - SWIPE_CAP) * 0.18);
    s.v = v;
    paint(v);
  };
  const onPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const s = st.current;
    if (!s || e.pointerId !== s.id) return;
    st.current = null;
    if (s.axis === "h") release(Math.abs(s.v) >= SWIPE_COMMIT);
  };

  return {
    ref,
    arrowRef,
    swipedRef,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
  };
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
  const isMedia = (m.kind === "gif" || m.kind === "image") && m.gifUrl;
  // A message that's pulled enough reactions glows — it's a "highlight".
  const reactionTotal = Object.values(m.reactions).reduce((n, r) => n + r.count, 0);
  const isHighlight = !isSystem && !isNowPlaying && !isResults && reactionTotal >= 5;
  const isEdited = (m.meta as { edited?: boolean } | null)?.edited === true;
  const canEdit =
    mine && m.kind === "text" &&
    Date.now() - new Date(m.createdAt).getTime() < EDIT_WINDOW_MS;

  const deepDive = useCountryDeepDive();
  const particles = useParticles();
  const lastTap = useRef(0); // for double-tap-a-text-bubble → ❤️
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
    const [c1, c2] = countryColors(cc ?? "");
    const isActive = !!cc && cc === nowPlayingCode;
    return (
      <motion.li
        initial={{ opacity: 0, scale: 0.97 }}
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
                    aria-label={`#${ballotPos} in your TOP 10 — tap to change`}
                    className="inline-flex items-center justify-center h-8 min-w-[2.25rem] px-2 rounded-full
                               bg-white/18 ring-1 ring-white/30 text-white font-display text-xs tabular-nums
                               active:scale-95 transition transform-gpu"
                  >
                    #{ballotPos}
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
    const sys = m.meta as { sysKey?: string; sysArg?: string | null } | null;
    const text = sys?.sysKey ? tDyn(lang, sys.sysKey, sys.sysArg ?? undefined) : m.body;
    return (
      <motion.li initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-center">
        <span className="text-[11px] text-white/40 px-3 py-1 rounded-full bg-white/[0.03]">{text}</span>
      </motion.li>
    );
  }

  return (
    <motion.li
      data-msg-id={m.id}
      initial={m.pending ? { opacity: 0, y: 8 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex ${mine ? "justify-end" : "justify-start"}`}
    >
      <div className={`relative max-w-[82%] sm:max-w-[68%] flex gap-2 ${mine ? "flex-row-reverse" : "flex-row"}`}>
        {!mine && (
          <div className={`h-9 w-9 shrink-0 rounded-xl overflow-hidden ring-1 ring-white/10 bg-white/[0.04] ${showHeader ? "" : "invisible"}`}>
            {m.meta && typeof m.meta.commentatorPhoto === "string" && m.meta.commentatorPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.meta.commentatorPhoto} alt="" className="h-full w-full object-cover" />
            ) : m.meta?.commentator ? (
              <div className="h-full w-full grid place-items-center text-sm leading-none">🎙️</div>
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
            // Quoted-message chip. Cap the width so a long quote can't
            // outgrow the bubble; anchor right when it's your reply so
            // the quote + bubble read as one right-aligned thread.
            <div className={`text-[11px] px-3 py-1.5 rounded-xl truncate bg-white/[0.03] ring-1 ring-white/10 text-white/55 max-w-[min(100%,18rem)] ${mine ? "self-end" : "self-start"}`}>
              <Reply className="h-3 w-3 inline-block mr-1 text-flamingo" />
              <span className="font-display text-white/75">{parent.name}</span>
              {": "}
              {parent.body ?? (parent.gifUrl ? "GIF" : t(lang, "chat_card"))}
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
                          ${isMedia ? "p-0" : "px-3.5 py-2"}
                          ${
                            isCard
                              ? "bg-flamingo/15 ring-1 ring-flamingo/40 text-white px-3.5 py-2"
                              : mine
                                ? "bg-white text-dark-blue"
                                : "bg-white/[0.06] ring-1 ring-white/10 text-white/90"
                          } ${m.pending ? "opacity-75" : ""} ${
                            isHighlight
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
                  <span className="whitespace-pre-wrap break-words">
                    {renderBody(m.body ?? "", participantNames)}
                  </span>
                  {isEdited && (
                    <span className="text-[10px] opacity-50 ml-1.5">({t(lang, "chat_edited")})</span>
                  )}
                </>
              )}
            </button>

            <AnimatePresence>
              {menuOpen && (
                <>
                  {/* reaction toolbar — sits ABOVE the bubble (iMessage-style) */}
                  <motion.div
                    key="reacts"
                    initial={{ opacity: 0, scale: 0.85, y: 8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 6 }}
                    transition={{ type: "spring", stiffness: 900, damping: 30, mass: 0.4 }}
                    onClick={(e) => e.stopPropagation()}
                    className={`absolute bottom-full mb-2 z-30 ${mine ? "right-0" : "left-0"}`}
                  >
                    <div className="flex items-center gap-2 p-2 rounded-full bg-black/80 ring-1 ring-white/12 backdrop-blur-md shadow-xl">
                      {QUICK_REACTS.map(({ emoji, bg }, i) => (
                        <motion.button
                          key={emoji}
                          type="button"
                          onClick={(e) => reactWithRain(e, emoji)}
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          transition={{ delay: i * 0.012, type: "spring", stiffness: 1000, damping: 24 }}
                          className={`h-11 w-11 shrink-0 rounded-full grid place-items-center text-xl leading-none
                                      ring-1 ring-white/20 bg-gradient-to-br ${bg}
                                      shadow-[0_4px_12px_-3px_rgba(0,0,0,0.55)] transition-transform active:scale-90`}
                        >
                          <span className="drop-shadow-[0_1px_1px_rgba(0,0,0,0.25)]">{emoji}</span>
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                  {/* actions — below the bubble */}
                  <motion.div
                    key="actions"
                    initial={{ opacity: 0, scale: 0.9, y: -8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: -6 }}
                    transition={{ type: "spring", stiffness: 900, damping: 30, mass: 0.4 }}
                    onClick={(e) => e.stopPropagation()}
                    className={`absolute top-full mt-2 z-30 ${mine ? "right-0" : "left-0"}`}
                  >
                    <div className="flex flex-col rounded-2xl bg-black/80 ring-1 ring-white/12 backdrop-blur-md overflow-hidden shadow-xl min-w-[10rem]">
                      <MenuAction onClick={onReply} icon={Reply} label={t(lang, "chat_reply")} />
                      {canEdit && <MenuAction onClick={onEdit} icon={Pencil} label={t(lang, "chat_edit")} />}
                      {m.body && <MenuAction onClick={onCopy} icon={Copy} label={t(lang, "chat_copy")} />}
                      {mine && <MenuAction onClick={onDelete} icon={Trash2} label={t(lang, "chat_delete")} danger />}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          {Object.keys(m.reactions).length > 0 && (
            <div className={`flex flex-wrap gap-1 ${mine ? "self-end" : "self-start"}`}>
              {Object.entries(m.reactions).map(([emoji, info]) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={(e) => (info.mine ? onReact(emoji) : reactWithRain(e, emoji))}
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
