"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { Bell, Dices, Medal, ListChecks, ChevronRight } from "lucide-react";
import { HeartFlag } from "@/components/flag";
import { countryName, getCountry } from "@/lib/countries";
import { isSupported as pushIsSupported } from "@/lib/push-client";
import { useRoomLive, useRoomTab } from "@/components/room-shell";
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
}: {
  meta: SysMeta | null;
  lang: Language;
}) {
  const key = meta?.sysKey;
  if (!key) return null;
  switch (key) {
    case "sys_cta_notifications":
      return <NotificationsCard lang={lang} />;
    case "sys_cta_vote":
      return <VoteOpenCard lang={lang} />;
    case "sys_cta_bet":
      return <BonusBetCard lang={lang} />;
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
        <span className="shrink-0 grid place-items-center h-12 w-12 rounded-2xl bg-flamingo/20 ring-1 ring-flamingo/40 text-flamingo">
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
        {/* Equalizer bars: now genuinely anchored to the bottom edge
            of the card (no pb padding) so they read as a stage chart
            rising from the floor. */}
        <div className="pointer-events-none absolute bottom-0 right-0 flex items-end gap-1.5 h-2/3 px-3 opacity-95">
          {[28, 64, 42, 88, 36].map((h, i) => (
            <span
              key={i}
              className="w-2 rounded-t-full bg-white/85 shadow-[0_0_10px_rgba(255,255,255,0.35)]"
              style={{ height: `${h}%` }}
            />
          ))}
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
function BonusBetCard({ lang }: { lang: Language }) {
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
      return open[Math.floor(Math.random() * open.length)];
    } catch {
      return null;
    }
  }, [code]);

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
            {["🏆", "🎯", "🎲", "🎤", "🥄", "🎙️", "🎺"].concat(["🏆", "🎯", "🎲", "🎤", "🥄", "🎙️", "🎺"]).map((c, i) => (
              <span
                key={`a${i}`}
                className="mr-2 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/15 ring-1 ring-white/20 text-base shadow-md"
              >
                {c}
              </span>
            ))}
          </span>
          <span
            className="flex w-max"
            style={{ animation: "uzk-marquee 28s linear infinite reverse" }}
          >
            {["💎", "🎼", "🍿", "📺", "🔮", "🌟", "✨"].concat(["💎", "🎼", "🍿", "📺", "🔮", "🌟", "✨"]).map((c, i) => (
              <span
                key={`b${i}`}
                className="mr-2 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/15 ring-1 ring-white/20 text-base shadow-md"
              >
                {c}
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
      className="rounded-3xl ring-1 ring-yellow/45 shadow-[0_18px_44px_-18px_oklch(72%_0.18_85_/_0.5)] overflow-hidden"
    >
      <div className="relative overflow-hidden p-5 flex flex-col gap-4 bg-gradient-to-br from-yellow/30 via-orange/20 to-purple/55">
        {/* Spotlight cone behind the #1 flag. */}
        <span
          className="pointer-events-none absolute inset-x-0 top-0 h-full"
          style={{
            background:
              "radial-gradient(60% 70% at 50% 0%, oklch(95% 0.19 95 / 0.45) 0%, transparent 70%)",
          }}
          aria-hidden
        />
        <header className="relative flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-[0.3em] font-display text-white/85 flex items-center gap-1.5">
            <Medal className="h-3 w-3 text-yellow" fill="currentColor" />
            {t(lang, "sys_cta_top3_eyebrow")}
          </p>
          <span className="text-2xl leading-none">🏆</span>
        </header>

        {/* #1 — hero row. Large heart-flag + country name + gold pill. */}
        {first && (
          <div className="relative flex items-center gap-4">
            <span className="shrink-0">
              <HeartFlag code={first} size="lg" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-[0.2em] text-yellow font-display flex items-center gap-1">
                <span className="text-base leading-none">🥇</span>
                {t(lang, "sys_cta_top3_first")}
              </p>
              <p className="font-display text-2xl text-white leading-tight truncate drop-shadow">
                {countryName(first, lang) ?? first.toUpperCase()}
              </p>
            </div>
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
      <span className="text-base leading-none shrink-0">{medal}</span>
      <HeartFlag code={code} size="sm" />
      <span className="text-xs font-display text-white truncate flex-1">
        {countryName(code, lang) ?? code.toUpperCase()}
      </span>
    </div>
  );
}
