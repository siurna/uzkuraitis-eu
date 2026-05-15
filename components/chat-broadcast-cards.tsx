"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { Bell, Dices, ListChecks, ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Flag, HeartFlag } from "@/components/flag";
import { WelcomeMarkdown } from "@/components/welcome-banner";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { FluentEmoji } from "@/components/fluent-emoji";
import { countryName, getCountry } from "@/lib/countries";
import { isSupported as pushIsSupported } from "@/lib/push-client";
import { useRoomLive, useRoomTab } from "@/components/room-shell";
import { useLeaderboard } from "@/components/leaderboard-provider";
import { useIdentity } from "@/lib/use-identity";
import { useFireOnceWhen } from "@/lib/use-fire-once-when";
import { fmt, t, tDyn, type MessageKey } from "@/lib/i18n";
import type { Language } from "@/lib/i18n";
import { HOST_COUNTRY } from "@/lib/scoring";

// Bet definitions for the broadcast suggestion picker. Keys match the
// `Bets` shape in localStorage (lib/scoring.ts). When the host fires
// the bonus-bets broadcast, we pick a random entry the viewer hasn't
// filled in yet and name-drop it into the card.
const BET_DEFS_FOR_BROADCAST: { key: string; labelKey: MessageKey }[] = [
  { key: "woodenSpoon", labelKey: "bet_wooden_spoon" },
  { key: "lt12To", labelKey: "bet_lt_12_to" },
  { key: "highestBig5", labelKey: "bet_big5" },
  { key: "juryWinner", labelKey: "bet_jury_winner" },
  { key: "televoteWinner", labelKey: "bet_televote_winner" },
  { key: "nulTelevote", labelKey: "bet_nul" },
  { key: "hostTop3", labelKey: "bet_host_top3" },
  { key: "winnerSolo", labelKey: "bet_solo_winner" },
  { key: "ltTotalPoints", labelKey: "bet_lt_total" },
];

// Each `sys_cta_*` system message gets a tailored card here. We
// dispatch by sysKey from chat-row; whatever this file returns is
// rendered as a chat row's "isCta" payload. Falls back to the plain
// rainbow-bordered banner when no specialised card matches.

type SysMeta = {
  sysKey?: string;
  sysArg?: string | null;
  // top3 broadcast carries the country codes in meta.codes — the
  // formatted "🇫🇮 Finland · …" string in sysArg is only the fallback.
  codes?: string[];
};

export function ChatBroadcastCard({
  meta,
  lang,
  messageId,
  messageCreatedAt,
}: {
  meta: SysMeta | null;
  lang: Language;
  /** Chat message id — lets per-card surfaces (SelfieCard's paparazzi
   *  flash, ThanksCard's confetti) key their "fire once" state per
   *  broadcast instance, instead of per-room (which means only the
   *  FIRST selfie / first thanks of the night ever triggers the
   *  animation). */
  messageId: string;
  /** ISO timestamp the message was posted. Used to gate animations
   *  on RECENCY — re-entering a chat that has an hour-old confetti
   *  message shouldn't re-fire the confetti, even if the
   *  sessionStorage stamp from the original fire was cleared. */
  messageCreatedAt: string;
}) {
  const key = meta?.sysKey;
  if (!key) return null;
  switch (key) {
    case "sys_cta_notifications":
      return <NotificationsCard lang={lang} />;
    case "sys_cta_vote":
      return <VoteOpenCard lang={lang} />;
    case "sys_cta_bet":
      return <BonusBetCard lang={lang} messageId={messageId} />;
    case "sys_cta_selfie":
      return (
        <SelfieCard
          lang={lang}
          messageId={messageId}
          messageCreatedAt={messageCreatedAt}
        />
      );
    case "sys_cta_welcome":
      return <WelcomeChatCard lang={lang} />;
    case "sys_cta_thanks":
      return (
        <ThanksCard
          lang={lang}
          messageId={messageId}
          messageCreatedAt={messageCreatedAt}
        />
      );
    case "sys_cta_top3":
      return <Top3PodiumCard codes={meta?.codes ?? null} fallback={meta?.sysArg ?? null} lang={lang} />;
    case "sys_cta_top3_empty":
      return <PlainBanner text={t(lang, "sys_cta_top3_empty")} />;
    default:
      // Other sys_cta_* keys keep the original simple banner so we
      // don't accidentally drop a message kind.
      return <PlainBanner text={tDyn(lang, key, meta?.sysArg ?? undefined)} />;
  }
}

// Generic rainbow-bordered banner — the default when a sys_cta_* key
// doesn't have a specialised card yet.
function PlainBanner({ text }: { text: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="rainbow-border rounded-2xl"
    >
      <div className="rounded-[14px] px-4 py-3 text-center bg-gradient-to-br from-dark-blue-800/95 to-dark-blue-900/95 text-white font-display text-sm leading-snug text-balance">
        {text}
      </div>
    </motion.div>
  );
}

// "Turn on notifications" — bigger card with current state pill that
// opens the notifications sheet on tap.
function NotificationsCard({ lang }: { lang: Language }) {
  // We can't reach the server-side state from here cheaply; use the
  // browser's Notification.permission as the cheap source of truth.
  // "default" / "denied" → off; "granted" + a worker active → "on".
  const [status, setStatus] = useState<"unsupported" | "on" | "off">("off");
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!pushIsSupported()) {
      setStatus("unsupported");
      return;
    }
    setStatus(Notification.permission === "granted" ? "on" : "off");
  }, []);

  const onOpen = () => {
    // Standalone notifications drawer — does NOT open the full settings
    // drawer behind it. presence-bar listens for this event.
    window.dispatchEvent(new Event("uzk:open-notifications-only"));
  };

  return (
    <motion.button
      type="button"
      onClick={onOpen}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="rainbow-border rounded-2xl w-full block text-left"
    >
      <div
        className="rounded-[14px] px-5 py-5 flex items-center gap-4
                   bg-gradient-to-br from-dark-blue-800/95 to-dark-blue-900/95"
      >
        <span className="shrink-0 grid place-items-center h-12 w-12 uzk-icon-squircle bg-flamingo/20 ring-1 ring-flamingo/40 text-flamingo">
          <Bell className="h-6 w-6" fill="currentColor" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-base text-white leading-tight">
            {t(lang, "sys_cta_notifications_title")}
          </p>
          <p className="text-xs text-white/65 leading-snug mt-0.5">
            {t(lang, "sys_cta_notifications_sub")}
          </p>
        </div>
        {/* Status pill — different copy + colour per state. */}
        <span
          className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 h-7 text-[11px] font-display uppercase tracking-wider
                      ${
                        status === "on"
                          ? "bg-turquoise/15 ring-1 ring-turquoise/40 text-turquoise"
                          : status === "unsupported"
                            ? "bg-white/[0.06] ring-1 ring-white/12 text-white/45"
                            : "bg-flamingo/15 ring-1 ring-flamingo/35 text-flamingo"
                      }`}
        >
          {status === "on"
            ? t(lang, "sys_cta_notifications_on")
            : status === "unsupported"
              ? t(lang, "sys_cta_notifications_unsupported")
              : t(lang, "sys_cta_notifications_off")}
        </span>
      </div>
    </motion.button>
  );
}

// "Lines are open!" — bigger card showing your TOP-10 progress.
function VoteOpenCard({ lang }: { lang: Language }) {
  const { setTab } = useRoomTab();
  const { code } = useRoomLive();
  const [filled, setFilled] = useState(0);

  useEffect(() => {
    if (!code) return;
    try {
      const raw = localStorage.getItem(`uzk_ballot_${code}`);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Array<{ countryCode: string | null }>;
      if (Array.isArray(parsed)) {
        setFilled(parsed.filter((s) => s.countryCode).length);
      }
    } catch {
      /* ignore corrupt draft */
    }
  }, [code]);

  const pct = Math.min(100, (filled / 10) * 100);
  const done = filled >= 10;
  return (
    // Border tinted to the card's own gradient (flamingo) instead of
    // the rainbow-border, so each broadcast card feels like its own
    // surface — not "another rainbow message in chat".
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-3xl ring-1 ring-flamingo/50 shadow-[0_18px_44px_-18px_oklch(58%_0.22_336_/_0.55)] overflow-hidden text-balance"
    >
      <div
        className="relative overflow-hidden px-5 pt-5 pb-5 flex flex-col gap-3"
        style={{ background: "linear-gradient(125deg, #f10d59 0%, #ff3ede 46%, #6020c6 100%)" }}
      >
        {/* Single ballot-box glyph off the right edge — the
            equalizer bars on the previous revision read as random
            audio meters that didn't tie to voting. A big 🗳️ in
            Fluent 3D is direct: "this is about your ballot". */}
        <div
          className="pointer-events-none absolute -right-2 bottom-1 -rotate-[8deg] opacity-95 drop-shadow"
          aria-hidden
        >
          <FluentEmoji glyph="🗳️" size={92} />
        </div>
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "linear-gradient(95deg, rgba(8,9,28,0.55) 0%, rgba(8,9,28,0.22) 38%, transparent 60%)" }}
        />
        <div className="relative flex flex-col gap-1.5 pr-[30%]">
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/90 font-display leading-tight flex items-center gap-1.5">
            <ListChecks className="h-3 w-3" />
            {t(lang, "sys_cta_vote_title")}
          </p>
          <p className="font-display text-xl sm:text-2xl text-white leading-tight drop-shadow">
            {done
              ? t(lang, "sys_cta_vote_done_headline")
              : filled > 0
                ? tDyn(lang, "sys_cta_vote_sub_progress", filled)
                : t(lang, "sys_cta_vote_sub_empty")}
          </p>
        </div>
        {/* Progress bar + count. Width capped at 70% so it never crosses
            into the equalizer bars to the right. */}
        <div className="relative max-w-[70%]">
          <div className="h-2 rounded-full bg-white/20 overflow-hidden">
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.55)]"
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
          <p className="absolute -top-5 right-0 text-[11px] font-display tabular-nums text-white/85 tracking-wider">
            {filled}/10
          </p>
        </div>
        {/* Explicit CTA button. Reads as an action, not a subtitle. */}
        <button
          type="button"
          onClick={() => setTab("vote")}
          className="relative self-start mt-1 inline-flex items-center gap-1.5 rounded-xl bg-white text-dark-blue
                     font-display text-sm h-10 px-4 active:scale-[0.97] transition transform-gpu"
        >
          {done
            ? t(lang, "sys_cta_vote_btn_adjust")
            : t(lang, "sys_cta_vote_btn_cast")}
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  );
}

// "Don't forget your bonus bets" — picks a random unfilled bet the
// viewer hasn't set yet and surfaces it as a concrete suggestion.
function BonusBetCard({ lang, messageId }: { lang: Language; messageId: string }) {
  const { setTab } = useRoomTab();
  const { code, homeCountryCode } = useRoomLive();
  const suggestion = useMemo(() => {
    if (typeof window === "undefined" || !code) return null;
    try {
      const raw = localStorage.getItem(`uzk_bets_${code}`);
      const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      const placed = new Set<string>();
      for (const [key, value] of Object.entries(parsed)) {
        if (value === null || value === undefined || value === "") continue;
        if (Array.isArray(value) && value.length === 0) continue;
        placed.add(key);
      }
      const open = BET_DEFS_FOR_BROADCAST.filter((b) => !placed.has(b.key));
      if (open.length === 0) return null;
      // Deterministic pick: hash the messageId to an index into the
      // open list. Same broadcast → same suggested bet across mounts
      // / reloads / tab switches. Previously this used Math.random()
      // which gave a fresh pick on every full page load.
      let hash = 0;
      for (let i = 0; i < messageId.length; i++) {
        hash = ((hash << 5) - hash + messageId.charCodeAt(i)) | 0;
      }
      return open[Math.abs(hash) % open.length];
    } catch {
      return null;
    }
  }, [code, messageId]);

  // Resolve any {home}/{host} placeholders in the suggested bet label.
  // Without this we'd literally print "Where does {home} finish?" in
  // the card.
  const homeName = homeCountryCode ? countryName(homeCountryCode, lang) : "";
  const hostName = countryName(HOST_COUNTRY, lang);
  const labelTemplate = suggestion ? t(lang, suggestion.labelKey) : "";
  const labelResolved = fmt(labelTemplate, { home: homeName, host: hostName });

  return (
    // Magenta-tinted border to match the card's own gradient (was
    // rainbow-border before).
    <motion.button
      type="button"
      onClick={() => {
        setTab("vote");
        // Open the bets sub-tab once the panel mounts.
        window.dispatchEvent(new CustomEvent("uzk:vote-tab", { detail: "bets" }));
      }}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-3xl w-full block text-left text-balance ring-1 ring-fuchsia/50
                 shadow-[0_18px_44px_-18px_oklch(58%_0.24_335_/_0.55)] overflow-hidden"
    >
      <div
        className="relative overflow-hidden px-5 pt-5 pb-5 min-h-[7.5rem] flex items-center gap-4"
        style={{ background: "linear-gradient(135deg, #bc1475 0%, #f10d59 100%)" }}
      >
        {/* Chip strips — two counter-rotating marquees stacked tight in
            the centre (top+bottom anchoring with no gap was making the
            strip read as two split rows clinging to the card edges).
            Vertically-stacked + centred so they sit as one cohesive
            block off the right. */}
        <span
          className="pointer-events-none absolute inset-y-0 -right-3 w-40 overflow-hidden
                     [mask-image:linear-gradient(90deg,transparent,#000_22%,#000_82%,transparent)]
                     flex flex-col justify-center gap-1.5"
          aria-hidden
        >
          <span
            className="flex w-max"
            style={{ animation: "uzk-marquee 22s linear infinite" }}
          >
            {/* Doubled so the looping CSS marquee never shows a gap.
                Listed twice rather than spread because emojis like
                🎙️ are multi-codepoint and JS spread breaks the
                variation-selector. */}
            {[
              "🏆", "🎤", "🎯", "🥄", "🎺", "🎙️", "🎲",
              "🏆", "🎤", "🎯", "🥄", "🎺", "🎙️", "🎲",
            ].map((c, i) => (
              <span
                key={`a${i}`}
                className="mr-2 grid h-9 w-9 shrink-0 place-items-center uzk-icon-squircle bg-white/15 ring-1 ring-white/20 shadow-md"
              >
                <FluentEmoji glyph={c} size={22} />
              </span>
            ))}
          </span>
          <span
            className="flex w-max"
            style={{ animation: "uzk-marquee 28s linear infinite reverse" }}
          >
            {[
              "💎", "🌟", "🎼", "🍿", "✨", "📺", "🔮",
              "💎", "🌟", "🎼", "🍿", "✨", "📺", "🔮",
            ].map((c, i) => (
              <span
                key={`b${i}`}
                className="mr-2 grid h-9 w-9 shrink-0 place-items-center uzk-icon-squircle bg-white/15 ring-1 ring-white/20 shadow-md"
              >
                <FluentEmoji glyph={c} size={22} />
              </span>
            ))}
          </span>
        </span>
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "linear-gradient(95deg, rgba(8,9,28,0.5) 0%, rgba(8,9,28,0.22) 38%, transparent 64%)" }}
        />
        <div className="relative flex flex-col gap-1 pr-[40%]">
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/85 font-display leading-tight flex items-center gap-1.5">
            <Dices className="h-3 w-3" />
            {suggestion
              ? t(lang, "sys_cta_bet_title_suggest")
              : t(lang, "sys_cta_bet_title_done")}
          </p>
          <p className="font-display text-lg text-white leading-tight drop-shadow">
            {suggestion
              ? tDyn(lang, "sys_cta_bet_suggest_sub", labelResolved)
              : t(lang, "sys_cta_bet_sub_done")}
          </p>
        </div>
      </div>
    </motion.button>
  );
}

// "Leading the room right now" — proper 2/1/3 podium pedestal.
function Top3PodiumCard({
  codes,
  fallback,
  lang,
}: {
  codes: string[] | null;
  fallback: string | null;
  lang: Language;
}) {
  if (!codes || codes.length === 0) {
    return <PlainBanner text={fallback ?? t(lang, "sys_cta_top3_empty")} />;
  }
  // Re-order to podium positions: 2nd left, 1st centre, 3rd right.
  const first = codes[0] ?? null;
  const second = codes[1] ?? null;
  const third = codes[2] ?? null;

  return (
    // Redesign: spotlight on the #1 (its flag is the hero), with #2 and
    // #3 as smaller chips on either side. The podium "step blocks" are
    // gone — they were cute but visually flat; the spotlight + flag
    // sizes already encode the ranking. Border tinted gold to match.
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-3xl ring-2 ring-white/10 shadow-[0_18px_44px_-22px_rgba(0,0,0,0.55)] overflow-hidden"
    >
      <div className="relative overflow-hidden px-5 py-7 flex flex-col gap-4 bg-gradient-to-br from-yellow/30 via-orange/20 to-purple/55">
        {/* Spotlight cone behind the #1 flag. */}
        <span
          className="pointer-events-none absolute inset-x-0 top-0 h-full"
          style={{
            background:
              "radial-gradient(60% 70% at 50% 0%, oklch(95% 0.19 95 / 0.45) 0%, transparent 70%)",
          }}
          aria-hidden
        />
        <header className="relative flex items-center">
          <p className="text-[10px] uppercase tracking-[0.3em] font-display text-white/85">
            {t(lang, "sys_cta_top3_eyebrow")}
          </p>
        </header>

        {/* #1 — hero row. Large heart-flag + gold medal leading the
            country name; the secondary "Leading" eyebrow is gone (the
            podium ordering carries that signal on its own). */}
        {first && (
          // Medal leads the row: 🥇 then heart-flag then country name.
          // Reads left-to-right as "this is the #1, and it's <country>"
          // — the gold trophy was previously between the flag and
          // name, which made the order ambiguous.
          <div className="relative flex items-center gap-3">
            <FluentEmoji glyph="🥇" size={44} className="shrink-0" ariaLabel="first place" />
            <span className="shrink-0">
              <HeartFlag code={first} size="lg" />
            </span>
            <p className="min-w-0 flex-1 font-display text-2xl text-white leading-tight truncate drop-shadow">
              {countryName(first, lang) ?? first.toUpperCase()}
            </p>
          </div>
        )}

        {/* #2 + #3 chips. */}
        {(second || third) && (
          <div className="relative grid grid-cols-2 gap-2">
            {second ? (
              <PodiumChip code={second} rank={2} lang={lang} />
            ) : (
              <span />
            )}
            {third ? (
              <PodiumChip code={third} rank={3} lang={lang} />
            ) : (
              <span />
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// "Hello folks" — the host fires this and the chat thread shows the
// housekeeping markdown the admin wrote in /admin/welcome, rendered
// in each viewer's own language. Fetches /api/welcome on mount and
// listens for `uzk:welcome-refresh` so admin saves push through to
// already-rendered cards without a reload.
type WelcomeData = { welcome_md_en: string; welcome_md_lt: string };

// Split a welcome markdown source at a `---[Button Text]---` line.
// Everything before the marker reads inline on the ticket card;
// everything after gets parked in a BottomSheet that opens when the
// host's "Button Text" button is tapped. The marker line itself is
// dropped from both halves. Returns `{ before, after, label }` with
// before always populated; after/label are null when the source has
// no split marker (the whole message renders inline).
const WELCOME_SPLIT_RE = /^---\s*\[(.+?)\]\s*---\s*$/m;
function splitWelcome(source: string): { before: string; after: string | null; label: string | null } {
  const match = WELCOME_SPLIT_RE.exec(source);
  if (!match) return { before: source, after: null, label: null };
  const idx = match.index;
  const after = source.slice(idx + match[0].length).trim();
  return {
    before: source.slice(0, idx).trim(),
    after: after.length > 0 ? after : null,
    label: match[1].trim() || "More",
  };
}

function WelcomeChatCard({ lang }: { lang: Language }) {
  const [data, setData] = useState<WelcomeData | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () => {
      fetch("/api/welcome", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: WelcomeData | null) => {
          if (alive && d) setData(d);
        })
        .catch(() => {});
    };
    load();
    window.addEventListener("uzk:welcome-refresh", load);
    return () => {
      alive = false;
      window.removeEventListener("uzk:welcome-refresh", load);
    };
  }, []);

  const md = (lang === "lt" ? data?.welcome_md_lt : data?.welcome_md_en) ?? "";
  // Concert ticket stub. Two halves split by a vertical dashed
  // perforation: the stub on the left carries the show identity
  // (ADMIT ONE strip across the top, "ESC 2026" + Vienna 16 May
  // sandwich on the body), the right half carries the host's
  // markdown message. The card itself is masked with two notches
  // (top + bottom) along the tear line so it reads as a real ticket
  // edge, not a panel with a divider painted on. Brand-gold
  // borders + dark navy interior keep it party-poster, not paper.
  //
  // The mask runs as two radial-gradients (transparent disc + opaque
  // ring) at the top and bottom of the tear-line x coordinate. WebKit
  // and the spec disagree on `mask-composite` keyword names, so we
  // duplicate as `-webkit-mask-image` + `mask-image` with the
  // matching composite values.
  const TEAR_X = "5.5rem";
  const ticketMask = {
    maskImage: `radial-gradient(circle at ${TEAR_X} 0, transparent 7px, #000 7.5px), radial-gradient(circle at ${TEAR_X} 100%, transparent 7px, #000 7.5px)`,
    maskComposite: "intersect",
    WebkitMaskImage: `radial-gradient(circle at ${TEAR_X} 0, transparent 7px, #000 7.5px), radial-gradient(circle at ${TEAR_X} 100%, transparent 7px, #000 7.5px)`,
    WebkitMaskComposite: "source-in",
  } as const;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, rotate: -1.5 }}
      animate={{ opacity: 1, y: 0, rotate: -0.5 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className="relative w-full mx-auto max-w-md sm:max-w-lg"
    >
      <div
        className="relative rounded-2xl overflow-hidden w-full
                   bg-gradient-to-br from-[#2a1408] via-[#3a1d05] to-[#1a0d02]
                   ring-1 ring-yellow/35
                   shadow-[0_18px_44px_-18px_rgba(0,0,0,0.55),0_0_0_1px_rgba(247,184,1,0.08),inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-18px_36px_-18px_rgba(247,184,1,0.18)]"
        style={ticketMask}
      >
        {/* Foil glow — two soft radial pools of warm gold (top-left
            corner where light "hits" + a smaller pool bottom-right)
            sit over the base gradient so the ticket reads as actual
            stamped foil instead of a flat brown card. */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(80% 60% at 8% 0%, rgba(255,215,140,0.22) 0%, transparent 55%), radial-gradient(60% 50% at 96% 100%, rgba(255,170,80,0.14) 0%, transparent 60%)",
          }}
        />
        {/* Foil sweep — wide diagonal warm band, drifting slowly with
            `mix-blend-screen`. The band itself is broader (30→70%
            range) and the loop runs at ~22s so the highlight is a
            very gentle ambient drift; the earlier 12s/narrow band
            read as a moving stripe. */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none mix-blend-screen overflow-hidden"
        >
          <div
            className="absolute inset-y-0 -left-1/4 w-[150%]"
            style={{
              background:
                "linear-gradient(115deg, transparent 30%, rgba(255,220,140,0.13) 50%, transparent 70%)",
              animation: "uzk-foil-sweep 22s ease-in-out infinite alternate",
            }}
          />
        </div>

        {/* ADMIT ONE strip across the top — runs full width across
            both halves of the stub. Tabular numerals on the right so
            the ticket "serial" reads as real ephemera. */}
        <div className="relative px-4 pt-2.5 pb-2 flex items-center justify-between border-b border-dashed border-yellow/25">
          <span className="text-[9px] uppercase tracking-[0.32em] font-display text-yellow/85">
            {t(lang, "ticket_admit_one")}
          </span>
          <span className="text-[9px] uppercase tracking-[0.28em] font-display text-yellow/60 tabular-nums">
            {t(lang, "ticket_serial")}
          </span>
        </div>

        <div className="relative grid" style={{ gridTemplateColumns: `${TEAR_X} 1fr` }}>
          {/* Stub half — left. Show identity sandwich: SHOW eyebrow,
              event title, location + date underneath. */}
          <div className="border-r border-dashed border-yellow/25 px-3 py-3.5 flex flex-col justify-center gap-1 text-center">
            <span className="text-[9px] uppercase tracking-[0.22em] font-display text-yellow/55">
              {t(lang, "ticket_show_eyebrow")}
            </span>
            <span className="font-display text-lg leading-tight text-yellow tracking-wide">
              ESC {t(lang, "host_year")}
            </span>
            <span className="text-[10px] text-yellow/55 leading-tight">
              {t(lang, "host_city")}
              <br />
              {t(lang, "final_date")}
            </span>
          </div>

          {/* Body half — the host's message. Same WelcomeMarkdown the
              home banner uses; colours inverted to read on the dark
              ticket surface. The split marker `---[Label]---` is a
              CONTENT marker the admin uses to flag "this is where the
              long version starts" — the ticket only ever shows the
              `before` half inline; the "Read more" button at the
              ticket's bottom is the single affordance to see the
              whole thing in a drawer. */}
          <div
            className="px-4 py-3.5 text-[14px] leading-relaxed text-white/90
                       [&_strong]:text-white [&_em]:text-white
                       [&_a]:text-yellow [&_a]:decoration-yellow/60 [&_a]:underline-offset-2"
          >
            {md.trim() ? (
              <WelcomeMarkdown source={splitWelcome(md).before} />
            ) : (
              <p className="text-[13px] text-white/45 italic">
                {t(lang, "welcome_empty_chat")}
              </p>
            )}
          </div>
        </div>

        {/* Bottom strip — only renders when the source has a `---[…]---`
            split, signalling there's more behind the cut. Mirrors the
            ADMIT ONE strip on top: dashed gold border + tracked
            uppercase pill. Sits flush against the ticket bottom edge
            with its own padding so it never feels orphaned by the
            content above. */}
        {md.trim() && splitWelcome(md).after && (
          <div className="relative px-4 py-3 flex justify-end border-t border-dashed border-yellow/25">
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className="inline-flex items-center gap-1 rounded-full
                         bg-yellow/15 ring-1 ring-yellow/40 text-yellow
                         px-3 h-7 text-[11px] font-display tracking-[0.18em] uppercase
                         hover:bg-yellow/25 active:scale-[0.97] transition"
            >
              {t(lang, "welcome_read_more")}
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {/* Full-text drawer — same BottomSheet pattern the home banner
          uses. Renders the entire markdown (admin's before + divider
          + after, the divider line itself is skipped by the renderer)
          so the user reads the host's complete message in one place. */}
      <BottomSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        title={t(lang, "welcome_drawer_title")}
      >
        <WelcomeMarkdown source={md} />
      </BottomSheet>
    </motion.div>
  );
}

// Window for the confetti to count as "fresh enough to fire". A
// brand-new ThanksCard arriving via chat:new broadcast is well
// within this; a scroll-back through chat history to an
// hours-old close-of-show card is way past it and the confetti
// stays put. The same window covers SelfieCard's paparazzi flash
// (defined as ANIMATION_FRESH_MS below for both).
const ANIMATION_FRESH_MS = 10 * 60 * 1000; // 10 minutes

// Closing-credits card. Confetti fires ONCE per browser per
// message — gated on:
//   1. The viewer is currently on the chat tab (no surprise
//      confetti during a bingo round).
//   2. The message is RECENT (< 10 min old, so re-entering the
//      chat tab on day 2 doesn't get fresh particles).
//   3. sessionStorage hasn't already stamped this message id
//      (covers the "user switched tabs and came back" case).
// If the user is on bingo/vote when the broadcast lands, the
// effect re-checks every time `tab` changes; the moment they
// switch to chat, conditions are met and confetti fires.
function ThanksCard({
  lang,
  messageId,
  messageCreatedAt,
}: {
  lang: Language;
  messageId: string;
  messageCreatedAt: string;
}) {
  const { payload } = useLeaderboard();
  const { tab } = useRoomTab();

  // Winner country: derived from the official placements payload
  // (placement === 1). Null until the host has entered results.
  const winner = useMemo(() => {
    if (!payload?.placements) return null;
    const entry = Object.entries(payload.placements).find(([, p]) => p === 1);
    return entry?.[0] ?? null;
  }, [payload]);

  // Computed once on mount. Calling Date.now() inline in render was
  // a smell (different value every render) and theoretically a
  // hydration mismatch source if this card ever pre-renders on the
  // server. `fresh` is a one-shot gate for the confetti animation;
  // it doesn't need to track the wall clock.
  const [fresh] = useState(
    () => Date.now() - Date.parse(messageCreatedAt) < ANIMATION_FRESH_MS,
  );

  const fireConfetti = useCallback(() => {
    void import("canvas-confetti").then(({ default: confetti }) => {
      const colors = ["#f7b801", "#ff2ede", "#ffffff", "#ff7d3a"];
      const shoot = (origin: { x: number; y: number }, angle: number) => {
        confetti({
          particleCount: 90,
          spread: 70,
          startVelocity: 55,
          angle,
          ticks: 260,
          gravity: 0.95,
          scalar: 1.05,
          origin,
          colors,
          zIndex: 60,
        });
      };
      shoot({ x: 0.05, y: 0.85 }, 60);
      shoot({ x: 0.95, y: 0.85 }, 120);
      setTimeout(() => {
        shoot({ x: 0.15, y: 0.95 }, 75);
        shoot({ x: 0.85, y: 0.95 }, 105);
      }, 360);
      setTimeout(() => {
        confetti({
          particleCount: 140,
          spread: 120,
          startVelocity: 45,
          ticks: 320,
          gravity: 1,
          origin: { x: 0.5, y: 0.4 },
          colors,
          zIndex: 60,
        });
      }, 780);
    });
  }, []);

  useFireOnceWhen({
    storageKey: `uzk_thanks_confetti_${messageId}`,
    when: tab === "chat" && fresh,
    onFire: fireConfetti,
  });

  // {next} substitution: drop the next year's number into the
  // closing line. `fmt` does the placeholder swap because the i18n
  // entry is a plain template string ("See you in {next}.") — using
  // tDyn alone returned the raw `{next}` literal, which read as a
  // bug at the ‘Thank you Europe’ moment.
  const nextYear = useMemo(() => {
    const y = new Date().getFullYear() + 1;
    return Number.isFinite(y) ? String(y) : t(lang, "sys_cta_thanks_next");
  }, [lang]);
  const sub = fmt(t(lang, "sys_cta_thanks_sub"), { next: nextYear });

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className="relative w-full mx-auto max-w-md sm:max-w-lg overflow-hidden rounded-3xl
                 ring-2 ring-yellow/40 shadow-[0_24px_64px_-22px_oklch(72%_0.18_85_/_0.6)]"
      style={{
        background:
          "radial-gradient(120% 90% at 50% 0%, oklch(95% 0.19 95 / 0.55) 0%, transparent 55%), linear-gradient(155deg, #4a1d05 0%, #6e2b07 45%, #2a1208 100%)",
      }}
    >
      <div className="relative px-5 py-8 flex flex-col items-center text-center gap-3">
        {/* Crown of the card. When placements are entered, this is
            the winning country's heart-flag (sized up + a warm outer
            glow so it reads as the focal moment, not a chip in the
            margin). When the host fires the closing card without yet
            typing official results (rehearsals, previews), the
            fallback is the 70-heart brand mark in the same slot — a
            trophy felt like a generic award; the brand heart is the
            actual closing image of every Eurovision broadcast. */}
        <motion.div
          initial={{ opacity: 0, scale: 0.5, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{
            type: "spring",
            stiffness: 220,
            damping: 18,
            delay: 0.18,
          }}
          className="mb-2 inline-flex items-center justify-center"
          style={{
            filter:
              "drop-shadow(0 6px 18px oklch(85% 0.18 80 / 0.45)) drop-shadow(0 0 32px oklch(85% 0.2 80 / 0.35))",
          }}
        >
          {winner ? (
            <Flag code={winner} size="lg" className="h-16 w-auto" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/images/70-heart.webp"
              alt=""
              width={80}
              height={80}
              className="h-20 w-auto object-contain heartbeat-loop"
              aria-hidden
            />
          )}
        </motion.div>
        <p className="text-[10px] uppercase tracking-[0.3em] font-display text-yellow/85">
          {t(lang, "sys_cta_thanks_eyebrow")}
        </p>
        {/* Narrower title (max-w-xs) + text-balance so the line wrap
            lands on natural phrase boundaries instead of a long
            single line edge-to-edge. */}
        <p className="font-display text-2xl leading-tight text-balance text-white drop-shadow-sm max-w-xs">
          {t(lang, "sys_cta_thanks_title")}
        </p>
        <p className="text-sm text-white/80 leading-snug">{sub}</p>
      </div>
    </motion.div>
  );
}

function PodiumChip({
  code,
  rank,
  lang,
}: {
  code: string;
  rank: 2 | 3;
  lang: Language;
}) {
  const medal = rank === 2 ? "🥈" : "🥉";
  return (
    <div className="flex items-center gap-2 rounded-xl bg-white/[0.08] ring-1 ring-white/15 px-3 py-2 min-w-0">
      <FluentEmoji glyph={medal} size={28} className="shrink-0" ariaLabel={`rank ${rank}`} />
      <HeartFlag code={code} size="sm" />
      <span className="text-xs font-display text-white truncate flex-1">
        {countryName(code, lang) ?? code.toUpperCase()}
      </span>
    </div>
  );
}

// Paparazzi flash positions. Six localized bright spots staggered
// around the viewport — top-left, top-right, mid-right, bottom-left,
// bottom-right, centre-ish — each firing on a different delay so the
// effect reads as a swarm of cameras flashing from different
// angles. Sizes vary slightly so the closer cameras feel brighter.
const PAPARAZZI_FLASHES: ReadonlyArray<{
  top: string;
  left: string;
  size: string;
  delay: number;
}> = [
  { top: "18%", left: "20%", size: "70vmin", delay: 0 },
  { top: "12%", left: "78%", size: "60vmin", delay: 0.14 },
  { top: "55%", left: "92%", size: "55vmin", delay: 0.28 },
  { top: "82%", left: "22%", size: "65vmin", delay: 0.42 },
  { top: "78%", left: "75%", size: "60vmin", delay: 0.56 },
  { top: "45%", left: "48%", size: "85vmin", delay: 0.70 },
];

// "Selfie time" — opens the device camera directly via a hidden
// <input type="file" capture="user"> so the OS jumps straight to the
// front-facing camera (a regular file picker is the fallback when
// `capture` isn't honoured). The card itself drives the existing
// chat upload + send flow so we don't have to weave a callback all
// the way back through chat-panel.
function SelfieCard({
  lang,
  messageId,
  messageCreatedAt,
}: {
  lang: Language;
  messageId: string;
  messageCreatedAt: string;
}) {
  const { code } = useRoomLive();
  const { tab } = useRoomTab();
  const { sessionId: getSession, name, avatarId } = useIdentity();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  // Paparazzi flash: a multi-photographer flurry that fires ONCE per
  // (browser × selfie message), gated on the same three conditions
  // as ThanksCard's confetti — chat tab is active, message is
  // recent, sessionStorage hasn't already stamped this id. Switching
  // to a different tab while a selfie broadcast lands keeps the
  // animation queued; the moment the user returns to chat, the
  // useFireOnceWhen below resolves true and the flash plays.
  const [flash, setFlash] = useState(false);
  // Computed once on mount; see ThanksCard for the same pattern.
  const [fresh] = useState(
    () => Date.now() - Date.parse(messageCreatedAt) < ANIMATION_FRESH_MS,
  );

  const fireFlash = useCallback(() => {
    // rAF so the row is painted before we flip flash on — otherwise
    // on slow first-paint the overlay can land before the chat
    // scroll has settled and the user misses the bottom of the
    // burst.
    requestAnimationFrame(() => setFlash(true));
    // No cleanup on the false-flip; setFlash on unmount is a no-op
    // in React 18+ and we'd rather guarantee the toggle than have
    // strict-mode cancel it.
    window.setTimeout(() => setFlash(false), 1400);
  }, []);

  useFireOnceWhen({
    storageKey: `uzk_selfie_flash_${code}_${messageId}`,
    when: !!code && !!messageId && tab === "chat" && fresh,
    onFire: fireFlash,
  });

  // Revoke object URLs we hold so we don't leak when the user picks
  // a new shot or the card unmounts.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const onPick = async (file: File) => {
    if (!file.type.startsWith("image/") || !code) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error(t(lang, "chat_image_too_big"));
      return;
    }
    // Show the picked shot inline IMMEDIATELY — the upload below is
    // async, but the polaroid window swaps to the local preview so
    // the host gets instant feedback that their tap landed.
    const localUrl = URL.createObjectURL(file);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(localUrl);
    setDone(false);
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const up = await fetch(`/api/rooms/${code}/chat/upload`, { method: "POST", body: form });
      if (!up.ok) {
        const { error } = (await up.json().catch(() => ({}))) as { error?: string };
        throw new Error(error ?? t(lang, "chat_image_failed"));
      }
      const { url } = (await up.json()) as { url: string };
      await fetch(`/api/rooms/${code}/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          session: getSession(),
          name: (name ?? "").trim() || "anonymous",
          avatarId,
          kind: "image",
          gifUrl: url,
        }),
      });
      setDone(true);
    } catch (err) {
      toast.error((err as Error).message);
      setPreviewUrl(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94, rotate: -3 }}
      animate={{ opacity: 1, scale: 1, rotate: -1.5 }}
      whileTap={{ scale: 0.99 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      // my-6 = extra vertical breathing room in the chat thread so
      // the polaroid is set apart from the rows above and below. The
      // polaroid itself reverts to its original snug padding.
      className="relative mx-auto max-w-[19rem] my-6"
    >
      {/* Paparazzi flash overlay — fires once per room when the card
          first lands in chat. Portalled to document.body because the
          parent motion.div has a `rotate` transform, which establishes
          a containing block for `position: fixed`. Without the
          portal the white pulse would clip to the polaroid's own
          ~19rem bounding box (rendered as a tiny white square inside
          the card) instead of covering the viewport. Same gotcha
          CLAUDE.md flags for PageTransition. pointer-events-none so
          the user can keep tapping the polaroid through it.
          Multi-photographer flurry: six localized flashes positioned
          around the viewport (top-left / top-right / mid-right /
          bottom-left / bottom-right / centre-ish), each a radial
          white-to-transparent burst staggered ~120-150ms apart. Reads
          like a small swarm of cameras firing at different angles
          rather than a single full-frame blast. */}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {flash && (
              <motion.div
                key="paparazzi"
                initial={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="fixed inset-0 z-[80] pointer-events-none"
                aria-hidden
              >
                {PAPARAZZI_FLASHES.map((spot, i) => (
                  <motion.span
                    key={i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 1, 0.6, 0] }}
                    transition={{
                      duration: 0.42,
                      delay: spot.delay,
                      times: [0, 0.08, 0.25, 1],
                      ease: "linear",
                    }}
                    style={{
                      position: "absolute",
                      top: spot.top,
                      left: spot.left,
                      width: spot.size,
                      height: spot.size,
                      transform: "translate(-50%, -50%)",
                      background:
                        "radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(255,255,255,0.85) 22%, rgba(255,255,255,0.3) 55%, rgba(255,255,255,0) 78%)",
                      filter: "blur(6px)",
                      mixBlendMode: "screen",
                    }}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void onPick(f);
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="relative block w-full text-left p-6 pb-5 rounded-sm
                   bg-[#f5efe2]
                   shadow-[0_18px_44px_-18px_rgba(0,0,0,0.55),0_2px_6px_-2px_rgba(0,0,0,0.4)]
                   active:scale-[0.99] transition transform-gpu disabled:opacity-70"
      >
        <span
          className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 h-5 w-20 rotate-[-3deg]
                     bg-[oklch(95%_0.08_95_/_0.7)] ring-1 ring-[oklch(85%_0.12_95_/_0.45)]
                     shadow-[0_2px_4px_-2px_rgba(0,0,0,0.3)]"
          aria-hidden
        />
        <span className="relative block aspect-square rounded-sm overflow-hidden
                          bg-gradient-to-br from-[#1a0f2b] via-[#2a1664] to-[#4a1f7a]">
          {previewUrl ? (
            // Once a shot is picked the polaroid window IS that shot,
            // immediately. The upload + chat-post happen in parallel.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <>
              <span
                className="absolute inset-0"
                style={{
                  background:
                    "radial-gradient(80% 60% at 50% 35%, oklch(58% 0.22 336 / 0.4) 0%, transparent 60%), radial-gradient(60% 70% at 90% 90%, oklch(70% 0.18 220 / 0.35) 0%, transparent 60%)",
                }}
                aria-hidden
              />
              <span className="relative h-full w-full grid place-items-center">
                <span className="grid h-20 w-20 place-items-center rounded-full
                                  bg-white/15 ring-1 ring-white/30 backdrop-blur-sm
                                  text-white shadow-[0_8px_24px_-8px_rgba(0,0,0,0.4)]">
                  {/* Fluent 3D camera's optical mass sits low —
                      nudge up so the chip reads as centred. */}
                  <FluentEmoji glyph="📸" size={48} className="-translate-y-[6px]" />
                </span>
              </span>
            </>
          )}
          {busy && previewUrl && (
            <span className="absolute inset-0 grid place-items-center bg-black/30">
              <Loader2 className="h-8 w-8 text-white animate-spin" />
            </span>
          )}
        </span>
        <span className="block px-1 pt-3 pb-2 text-center">
          <span
            className="block font-display text-[10px] uppercase tracking-[0.32em] text-[#8a614a]"
          >
            {t(lang, "sys_cta_selfie_eyebrow")}
          </span>
          <span
            className="block font-display text-lg text-[#3a1f12] leading-tight mt-0.5 text-balance"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {busy
              ? t(lang, "sys_cta_selfie_sending")
              : done
                ? t(lang, "sys_cta_selfie_done_title")
                : t(lang, "sys_cta_selfie_title")}
          </span>
          <span className="block text-[11px] text-[#6e4b35] leading-snug mt-1 text-balance">
            {done ? t(lang, "sys_cta_selfie_done_sub") : t(lang, "sys_cta_selfie_sub")}
          </span>
        </span>
      </button>
    </motion.div>
  );
}
