"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowRight,
  MessageCircle,
  ListChecks,
  Trophy,
} from "lucide-react";
import { useRoomLive, useRoomTab } from "@/components/room-shell";
import { getCountry, countryName } from "@/lib/countries";
import { countryColors } from "@/lib/country-colors";
import { participantPhoto } from "@/lib/participants";
import { optimizedSrc } from "@/lib/img";
import { buildBingoCard, FREE_SQUARE, tropeEmoji } from "@/lib/bingo-tropes";
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
  onClick,
  bg,
  accentRing,
  icon,
  eyebrow,
  title,
  sub,
  rainbow,
}: {
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
      className={`relative overflow-hidden ${
        rainbow ? "rounded-[22px]" : `rounded-3xl ring-1 ${accentRing ?? "ring-white/10"} glass-card`
      }`}
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
  return (
    <button
      type="button"
      onClick={onClick}
      className={`block w-full text-left ${rainbow ? "rainbow-border rounded-3xl" : ""}`}
    >
      {body}
    </button>
  );
}

export function HomeBanners() {
  const { code, votingEnabled, tallyEnabled, nowPlayingCode, showStatus } = useRoomLive();
  const lang = useLang();
  const { setTab } = useRoomTab();
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

  return (
    <div className="container mx-auto max-w-3xl px-4 flex flex-col gap-3">
      {/* 1 — who's on stage right now (the hero card) */}
      {playing && (
        <PlayingCard country={playing} lang={lang} onOpen={() => setTab("chat")} />
      )}

      {/* 2 — voting */}
      {votingEnabled &&
        (voted ? (
          <Card
            onClick={() => setTab("vote")}
            icon={<ListChecks className="h-6 w-6 text-turquoise" />}
            accentRing="ring-turquoise/20"
            bg="linear-gradient(120deg, rgba(64,224,208,0.10), transparent 60%)"
            title={t(lang, "home_vote_done")}
            sub={t(lang, "home_vote_done_sub")}
          />
        ) : (
          <Card
            onClick={() => setTab("vote")}
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

      {/* 4 — bingo widget */}
      <BingoWidget lang={lang} struck={bingoStruck} onOpen={() => setTab("bingo")} />
    </div>
  );
}

// The bingo invite on Home — a rainbow-bordered card with a little 3×3
// preview (a struck diagonal hints at the win condition) + progress.
const BINGO_PREVIEW = buildBingoCard("uzk-home-preview")
  .filter((i) => i !== FREE_SQUARE)
  .slice(0, 9);
const BINGO_PREVIEW_STRUCK = new Set([0, 4, 8]);

function BingoWidget({
  lang,
  struck,
  onOpen,
}: {
  lang: "en" | "lt";
  struck: number | null;
  onOpen: () => void;
}) {
  return (
    <button type="button" onClick={onOpen} className="w-full text-left rainbow-border rounded-3xl block">
      <div className="relative overflow-hidden rounded-[22px] bg-dark-blue-900/85 px-4 py-4 flex items-center gap-4">
        <div className="absolute inset-0 pointer-events-none"
             style={{ background: "linear-gradient(120deg, rgba(146,87,255,0.16), rgba(255,46,222,0.08) 55%, transparent)" }} />
        <div className="relative shrink-0 grid grid-cols-3 gap-1 p-1.5 rounded-xl bg-black/30 ring-1 ring-white/12">
          {BINGO_PREVIEW.map((idx, i) => {
            const x = BINGO_PREVIEW_STRUCK.has(i);
            return (
              <span key={i} className="relative h-6 w-6 grid place-items-center text-[13px] leading-none rounded-md bg-white/[0.04]">
                <span className={x ? "opacity-25 grayscale" : ""}>{tropeEmoji(idx)}</span>
                {x && <span className="absolute inset-0 grid place-items-center text-flamingo text-[15px] font-bold leading-none">✕</span>}
              </span>
            );
          })}
        </div>
        <div className="relative min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-[0.32em] text-flamingo font-display leading-tight mb-0.5">BINGO</p>
          <p className="font-display text-lg text-white leading-tight">{t(lang, "bingo_widget_title")}</p>
          <p className="text-sm text-white/55 leading-snug mt-0.5">
            {struck != null ? t(lang, "home_bingo_progress", struck) : t(lang, "home_bingo_sub")}
          </p>
        </div>
        <ArrowRight className="relative h-5 w-5 text-white/35 shrink-0" />
      </div>
    </button>
  );
}

// The "now playing" hero card — built like the artist deep-dive: a
// press-kit photo (when we have one) with a flag-colour gradient, the
// heart-flag chip + country name + artist/song over it. Tap → the full
// deep-dive sheet. Falls back to a colour-wash layout with no photo.
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
  const photo = participantPhoto(country.code);

  if (photo) {
    return (
      <button type="button" onClick={onOpen} className="w-full text-left rainbow-border rounded-3xl block">
        <div className="relative overflow-hidden rounded-[22px] aspect-[16/10] sm:aspect-[2/1]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={optimizedSrc(photo, 1080)} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(110deg, ${hexA(c1, 0.5)}, ${hexA(c2, 0.28)} 45%, transparent 70%), linear-gradient(0deg, rgba(8,9,28,0.92), rgba(8,9,28,0.1) 55%, transparent)`,
            }}
          />
          <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5 flex items-end gap-3">
            <span className="heartbeat shrink-0">
              <HeartFlag code={country.code} size="md" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-[0.32em] text-white/85 font-display leading-tight mb-0.5 drop-shadow">
                {t(lang, "now_playing")}
              </p>
              <p className="font-display text-2xl text-white leading-tight truncate drop-shadow">
                {countryName(country.code, lang)}
              </p>
              {(country.artist || country.song) && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {country.artist && (
                    <span className="rounded-full bg-white/15 backdrop-blur-sm ring-1 ring-white/20 px-2 py-0.5 text-[11px] text-white">
                      {country.artist}
                    </span>
                  )}
                  {country.song && (
                    <span className="rounded-full bg-white/10 backdrop-blur-sm ring-1 ring-white/15 px-2 py-0.5 text-[11px] italic text-white/80">
                      {country.song}
                    </span>
                  )}
                </div>
              )}
            </div>
            <MessageCircle className="h-5 w-5 text-white/80 shrink-0 mb-1" />
          </div>
        </div>
      </button>
    );
  }

  return (
    <button type="button" onClick={onOpen} className="w-full text-left rainbow-border rounded-3xl block">
      <div
        className="relative overflow-hidden rounded-[22px] px-5 py-5 sm:px-6"
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
          <MessageCircle className="h-5 w-5 text-white/70 shrink-0" />
        </div>
      </div>
    </button>
  );
}
