"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  ChevronRight,
  MessageCircle,
  Grid3x3,
  ListChecks,
  Trophy,
} from "lucide-react";
import type { Route } from "next";
import { useRoomLive } from "@/components/room-shell";
import { useCountryDeepDive } from "@/components/country-deep-dive";
import { getCountry, countryName } from "@/lib/countries";
import { HeartFlag } from "@/components/flag";
import { useLang, t } from "@/lib/i18n";

// Context- + timing-aware shortcut banners on the Home tab. Surfaces
// the one thing you should do *right now* (artist on stage / vote /
// results) up top, with the always-there shortcuts (bingo, chat) below.

// A plain glass row banner.
function Row({
  href,
  onClick,
  icon,
  title,
  sub,
  badge,
  accent,
}: {
  href?: Route;
  onClick?: () => void;
  icon: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  badge?: ReactNode;
  accent?: boolean;
}) {
  const inner = (
    <div
      className={`group flex items-center gap-3 rounded-2xl px-4 py-3.5 transition w-full text-left
                  ${accent
                    ? "bg-flamingo/10 ring-1 ring-flamingo/25 hover:bg-flamingo/[0.14]"
                    : "bg-white/[0.04] ring-1 ring-white/8 hover:bg-white/[0.07]"}`}
    >
      <span className="shrink-0 grid place-items-center h-10 w-10 rounded-xl bg-white/[0.06] text-white/80">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-sm text-white leading-tight flex items-center gap-2">
          {title}
          {badge}
        </p>
        {sub && <p className="text-xs text-white/50 leading-tight mt-0.5 truncate">{sub}</p>}
      </div>
      <ChevronRight className="h-4 w-4 text-white/30 shrink-0 group-hover:text-white/55 transition" />
    </div>
  );
  if (href) return <Link href={href} className="block">{inner}</Link>;
  return (
    <button type="button" onClick={onClick} className="block w-full">
      {inner}
    </button>
  );
}

// The big rainbow CTA variant (voting).
function CtaBanner({ href, label, sub }: { href: Route; label: string; sub?: string }) {
  return (
    <Link href={href} className="rainbow-border rounded-2xl block">
      <span className="flex items-center gap-3 rounded-[14px] bg-white text-dark-blue px-4 py-3">
        <ListChecks className="h-5 w-5 shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block font-display text-sm leading-tight">{label}</span>
          {sub && <span className="block text-[11px] text-dark-blue/55 leading-tight mt-0.5 truncate">{sub}</span>}
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 opacity-60" />
      </span>
    </Link>
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
    <div className="container mx-auto max-w-3xl px-4 flex flex-col gap-2.5">
      {/* Show-status pill */}
      <motion.p
        key={showStatus}
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-[11px] uppercase tracking-[0.24em] text-white/45 font-display text-center"
      >
        {t(lang, statusKey)}
      </motion.p>

      {/* 1 — who's on stage right now */}
      {playing && (
        <button
          type="button"
          onClick={() => deepDive.open(playing.code)}
          className="rainbow-border rounded-2xl block w-full text-left"
        >
          <span className="flex items-center gap-3 rounded-[14px] bg-dark-blue-900/85 px-4 py-3.5">
            <span className="heartbeat shrink-0">
              <HeartFlag code={playing.code} size="md" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] uppercase tracking-[0.3em] text-flamingo font-display leading-tight">
                {t(lang, "now_playing")}
              </span>
              <span className="block font-display text-white truncate leading-tight">
                {countryName(playing.code, lang)}
              </span>
              <span className="block text-xs text-white/50 truncate leading-tight">
                {playing.artist}
                {playing.song ? <span className="italic"> · {playing.song}</span> : null}
              </span>
            </span>
            <ChevronRight className="h-4 w-4 text-white/30 shrink-0" />
          </span>
        </button>
      )}

      {/* 2 — voting */}
      {votingEnabled &&
        (voted ? (
          <Row
            href={`/r/${code}/vote` as Route}
            icon={<ListChecks className="h-5 w-5" />}
            title={t(lang, "home_vote_done")}
            sub={t(lang, "home_vote_done_sub")}
          />
        ) : (
          <CtaBanner
            href={`/r/${code}/vote` as Route}
            label={t(lang, "home_vote_open")}
            sub={t(lang, "home_vote_open_sub")}
          />
        ))}

      {/* 3 — results */}
      {tallyEnabled && (
        <Row
          onClick={() =>
            document.getElementById("standings")?.scrollIntoView({ behavior: "smooth", block: "start" })
          }
          icon={<Trophy className="h-5 w-5 text-gold" />}
          title={t(lang, "home_results")}
          sub={t(lang, "home_results_sub")}
          accent
        />
      )}

      {/* 4 — bingo */}
      <Row
        href={`/r/${code}/bingo` as Route}
        icon={<Grid3x3 className="h-5 w-5" />}
        title={t(lang, "bingo_title")}
        sub={t(lang, "home_bingo_sub")}
        badge={
          bingoStruck != null ? (
            <span className="text-[10px] tabular-nums text-white/40 font-sans">
              {t(lang, "home_bingo_progress", bingoStruck)}
            </span>
          ) : undefined
        }
      />

      {/* 5 — chat */}
      <Row
        href={`/r/${code}/chat` as Route}
        icon={<MessageCircle className="h-5 w-5" />}
        title={t(lang, "home_chat")}
        sub={t(lang, "home_chat_sub")}
      />
    </div>
  );
}
