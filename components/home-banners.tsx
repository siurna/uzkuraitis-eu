"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  ArrowRight,
  MessageCircle,
  Grid3x3,
  ListChecks,
  Trophy,
} from "lucide-react";
import type { Route } from "next";
import { useRoomLive } from "@/components/room-shell";
import { useCountryDeepDive } from "@/components/country-deep-dive";
import { getCountry, countryName } from "@/lib/countries";
import { countryColors } from "@/lib/country-colors";
import { HeartFlag } from "@/components/flag";
import { useLang, t } from "@/lib/i18n";

// Context- + timing-aware shortcut CARDS on the Home tab. The thing
// you should do *right now* (artist on stage / vote / results) sits up
// top as a big card; the always-there shortcuts (bingo, chat) follow.

// "#rrggbb" + alpha → "rgba(...)". (Tiny dup of the takeover helper.)
function hexA(hex: string, a: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

// A tappable card. `bg` is an inline gradient laid over the glass card;
// `accentRing` tints the border. Renders as <Link> or <button>.
function Card({
  href,
  onClick,
  bg,
  accentRing,
  icon,
  eyebrow,
  title,
  sub,
  rainbow,
}: {
  href?: Route;
  onClick?: () => void;
  bg?: string;
  accentRing?: string;
  icon: ReactNode;
  eyebrow?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  rainbow?: boolean;
}) {
  const body = (
    <div
      className={`relative overflow-hidden rounded-3xl ${
        rainbow ? "" : `ring-1 ${accentRing ?? "ring-white/10"}`
      } ${rainbow ? "" : "glass-card"}`}
    >
      {bg && <div className="absolute inset-0 pointer-events-none" style={{ background: bg }} />}
      <div className="relative flex items-center gap-4 px-5 py-5 sm:px-6">
        <span className="shrink-0 grid place-items-center h-12 w-12 rounded-2xl bg-white/[0.08] ring-1 ring-white/12 text-white">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          {eyebrow && (
            <p className="text-[10px] uppercase tracking-[0.3em] text-flamingo font-display leading-tight mb-0.5">
              {eyebrow}
            </p>
          )}
          <p className="font-display text-lg text-white leading-tight">{title}</p>
          {sub && <p className="text-sm text-white/55 leading-snug mt-0.5">{sub}</p>}
        </div>
        <ArrowRight className="h-5 w-5 text-white/35 shrink-0" />
      </div>
    </div>
  );
  const cls = "block";
  if (href) return <Link href={href} className={rainbow ? "rainbow-border rounded-3xl block" : cls}>{body}</Link>;
  return (
    <button type="button" onClick={onClick} className={`w-full text-left ${rainbow ? "rainbow-border rounded-3xl" : ""} ${cls}`}>
      {body}
    </button>
  );
}

export function HomeBanners() {
  const { code, votingEnabled, tallyEnabled, nowPlayingCode, showStatus } = useRoomLive();
  const lang = useLang();
  const deepDive = useCountryDeepDive();
  const [voted, setVoted] = useState(false);
  const [bingoStruck, setBingoStruck] = useState<number | null>(null);

  useEffect(() => {
    setVoted(localStorage.getItem(`uzk_voted_${code}`) === "1");
    try {
      const tickets = JSON.parse(localStorage.getItem(`uzk_bingo_tickets_${code}`) ?? "[]");
      if (Array.isArray(tickets) && tickets[0]) {
        const struck = Array.isArray(tickets[0].struck) ? tickets[0].struck.length : 0;
        setBingoStruck(Math.min(25, struck + 1)); // +1 for the auto-struck FREE square
      }
    } catch {
      /* ignore */
    }
  }, [code]);

  const playing =
    showStatus === "in_progress" && nowPlayingCode ? getCountry(nowPlayingCode) : null;

  const statusKey = (
    {
      not_started: "home_status_not_started",
      in_progress: "home_status_in_progress",
      break: "home_status_break",
      ended: "home_status_ended",
    } as const
  )[showStatus];

  return (
    <div className="container mx-auto max-w-3xl px-4 flex flex-col gap-3">
      {/* Show-status pill */}
      <motion.p
        key={showStatus}
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-[11px] uppercase tracking-[0.24em] text-white/45 font-display text-center"
      >
        {t(lang, statusKey)}
      </motion.p>

      {/* 1 — who's on stage right now (the hero card) */}
      {playing && (
        <PlayingCard country={playing} lang={lang} onOpen={() => deepDive.open(playing.code)} />
      )}

      {/* 2 — voting */}
      {votingEnabled &&
        (voted ? (
          <Card
            href={`/r/${code}/vote` as Route}
            icon={<ListChecks className="h-6 w-6 text-turquoise" />}
            accentRing="ring-turquoise/20"
            bg="linear-gradient(120deg, rgba(64,224,208,0.10), transparent 60%)"
            title={t(lang, "home_vote_done")}
            sub={t(lang, "home_vote_done_sub")}
          />
        ) : (
          <Card
            href={`/r/${code}/vote` as Route}
            rainbow
            icon={<ListChecks className="h-6 w-6 text-white" />}
            eyebrow={t(lang, "live")}
            title={t(lang, "home_vote_open")}
            sub={t(lang, "home_vote_open_sub")}
            bg="linear-gradient(120deg, rgba(255,46,222,0.18), rgba(76,201,240,0.12) 60%, transparent)"
          />
        ))}

      {/* 3 — results */}
      {tallyEnabled && (
        <Card
          onClick={() =>
            (document.getElementById("my-results") ?? document.getElementById("standings"))?.scrollIntoView({
              behavior: "smooth",
              block: "start",
            })
          }
          icon={<Trophy className="h-6 w-6 text-gold" />}
          accentRing="ring-gold/25"
          bg="linear-gradient(120deg, rgba(255,214,10,0.14), transparent 60%)"
          eyebrow="🏆"
          title={t(lang, "home_results")}
          sub={t(lang, "home_results_sub")}
        />
      )}

      {/* 4 — bingo (with progress bar) */}
      <Card
        href={`/r/${code}/bingo` as Route}
        icon={<Grid3x3 className="h-6 w-6 text-purple" />}
        bg="linear-gradient(120deg, rgba(146,87,255,0.12), transparent 60%)"
        title={t(lang, "bingo_title")}
        sub={
          bingoStruck != null ? (
            <span className="flex items-center gap-2">
              <span className="relative h-1.5 w-28 rounded-full bg-white/10 overflow-hidden">
                <span
                  className="absolute inset-y-0 left-0 rounded-full bg-flamingo"
                  style={{ width: `${(bingoStruck / 25) * 100}%` }}
                />
              </span>
              <span className="text-xs text-white/45 tabular-nums">{t(lang, "home_bingo_progress", bingoStruck)}</span>
            </span>
          ) : (
            t(lang, "home_bingo_sub")
          )
        }
      />

      {/* 5 — chat */}
      <Card
        href={`/r/${code}/chat` as Route}
        icon={<MessageCircle className="h-6 w-6 text-turquoise" />}
        bg="linear-gradient(120deg, rgba(64,224,208,0.10), transparent 60%)"
        title={t(lang, "home_chat")}
        sub={t(lang, "home_chat_sub")}
      />
    </div>
  );
}

// The "now playing" hero card — washed in the flag's colours, big
// heart-flag, country name, artist · song. Tap → artist deep-dive.
function PlayingCard({
  country,
  lang,
  onOpen,
}: {
  country: NonNullable<ReturnType<typeof getCountry>>;
  lang: "en" | "lt";
  onOpen: () => void;
}) {
  const [c1, c2] = countryColors(country.code);
  return (
    <button type="button" onClick={onOpen} className="w-full text-left rainbow-border rounded-3xl block">
      <div
        className="relative overflow-hidden rounded-[20px] px-5 py-5 sm:px-6"
        style={{
          background: `linear-gradient(125deg, ${hexA(c1, 0.28)}, ${hexA(c2, 0.18)} 55%, rgba(10,11,34,0.85))`,
        }}
      >
        <div className="flex items-center gap-4">
          <span className="heartbeat shrink-0">
            <HeartFlag code={country.code} size="lg" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-[0.32em] text-white font-display leading-tight mb-1 drop-shadow">
              {t(lang, "now_playing")}
            </p>
            <p className="font-display text-2xl text-white leading-tight truncate drop-shadow">
              {countryName(country.code, lang)}
            </p>
            <p className="text-sm text-white/75 leading-tight truncate mt-0.5">
              {country.artist}
              {country.song ? <span className="italic text-white/55"> · {country.song}</span> : null}
            </p>
          </div>
          <ArrowRight className="h-5 w-5 text-white/55 shrink-0" />
        </div>
      </div>
    </button>
  );
}
