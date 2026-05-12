"use client";

import { useEffect, useState, type ReactNode, type CSSProperties } from "react";
import { motion } from "motion/react";
import { ArrowRight, MessageCircle } from "lucide-react";
import { useRoomLive, useRoomTab } from "@/components/room-shell";
import { getCountry, countryName } from "@/lib/countries";
import { countryColors } from "@/lib/country-colors";
import { participantPhoto } from "@/lib/participants";
import { optimizedSrc } from "@/lib/img";
import { buildBingoCard, FREE_SQUARE, tropeEmoji } from "@/lib/bingo-tropes";
import { HeartFlag } from "@/components/flag";
import { useLang, t } from "@/lib/i18n";

// Context- + timing-aware promo cards on the Home tab. The thing you
// should do *right now* (artist on stage) sits up top as the photo hero;
// the rest (vote / results / bingo) are PromoWidgets — same shape, a
// little preview "visual" on the left, distinct accent wash each.

// "#rrggbb" + alpha → "rgba(...)". (Tiny dup of the takeover helper.)
function hexA(hex: string, a: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

// A `.rainbow-border`-style stroke, but painted in a country's own
// flag colours — used on the "now playing" hero so each performance
// reads in its own palette instead of the generic rainbow.
function countryBorderStyle(c1: string, c2: string): CSSProperties {
  return {
    padding: "var(--rainbow-thickness)",
    backgroundImage: `linear-gradient(135deg, ${c1}, ${c2})`,
  };
}

// The shared promo-card shape (extracted from the bingo widget the
// design landed on): rainbow-stroked, a dark inner panel with an accent
// gradient wash, a left "visual", an eyebrow + title + sub, a trailing
// chevron/icon.
function PromoWidget({
  accent,
  eyebrow,
  title,
  sub,
  visual,
  trailing = <ArrowRight className="relative h-5 w-5 text-dark-blue-300 shrink-0" />,
  onClick,
}: {
  accent: string;
  eyebrow: ReactNode;
  title: ReactNode;
  sub: ReactNode;
  visual: ReactNode;
  trailing?: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rainbow-border rounded-3xl block transform-gpu transition duration-150 active:scale-[0.99]"
    >
      <div className="relative overflow-hidden rounded-[22px] bg-dark-blue-900/85 px-4 py-4 flex items-center gap-4">
        <div className="absolute inset-0 pointer-events-none" style={{ background: accent }} />
        <div className="relative shrink-0">{visual}</div>
        <div className="relative min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-[0.32em] text-flamingo font-display leading-tight mb-0.5">{eyebrow}</p>
          <p className="font-display text-lg text-white leading-tight">{title}</p>
          <p className="text-sm text-white/55 leading-snug mt-0.5">{sub}</p>
        </div>
        {trailing}
      </div>
    </button>
  );
}

// Small "preview tile" wrapper for the left visual — a dark rounded box.
function VisualBox({ children }: { children: ReactNode }) {
  return (
    <div className="grid place-items-center h-14 w-14 rounded-xl bg-black/30 ring-1 ring-white/12">
      {children}
    </div>
  );
}

// Bingo: a 3×3 mini grid; a struck diagonal hints at the win condition.
const BINGO_PREVIEW = buildBingoCard("uzk-home-preview")
  .filter((i) => i !== FREE_SQUARE)
  .slice(0, 9);
const BINGO_PREVIEW_STRUCK = new Set([0, 4, 8]);

// Denominator for the now-playing progress bar — grand-final size.
// (Our `countries` list is all participants, not just finalists, so a
// fixed constant is the honest call here.)
const GRAND_FINAL_ACTS = 26;

export function HomeBanners() {
  const { code, votingEnabled, tallyEnabled, nowPlayingCode, showStatus, runningOrderPos } = useRoomLive();
  const lang = useLang();
  const { setTab } = useRoomTab();
  const [voted, setVoted] = useState(false);
  // Best progress across all bingo tickets (a single "X / 25" is wrong
  // once you hold more than one) + whether any of them already hit bingo.
  const [bingo, setBingo] = useState<{ best: number; won: boolean } | null>(null);

  useEffect(() => {
    setVoted(localStorage.getItem(`uzk_voted_${code}`) === "1");
    try {
      const tickets = JSON.parse(localStorage.getItem(`uzk_bingo_tickets_${code}`) ?? "[]") as {
        struck?: unknown[];
        bingoFired?: boolean;
      }[];
      if (Array.isArray(tickets) && tickets.length > 0) {
        // +1 per ticket for the auto-struck FREE centre square.
        const counts = tickets.map((tk) =>
          Math.min(25, (Array.isArray(tk.struck) ? tk.struck.length : 0) + 1),
        );
        setBingo({ best: Math.max(...counts), won: tickets.some((tk) => !!tk.bingoFired) });
      }
    } catch {
      /* ignore */
    }
  }, [code]);

  const playing =
    showStatus === "in_progress" && nowPlayingCode ? getCountry(nowPlayingCode) : null;

  return (
    <div className="container mx-auto max-w-3xl px-4 flex flex-col gap-3">
      {/* 1 — who's on stage right now (the hero) */}
      {playing && (
        <PlayingCard country={playing} lang={lang} pos={runningOrderPos} onOpen={() => setTab("chat")} />
      )}

      {/* 2 — voting (turquoise/blue) */}
      {votingEnabled && (
        <PromoWidget
          accent="linear-gradient(120deg, rgba(64,224,208,0.18), rgba(76,201,240,0.10) 55%, transparent)"
          eyebrow={voted ? t(lang, "home_vote_done_eyebrow") : t(lang, "live")}
          title={t(lang, voted ? "home_vote_done" : "home_vote_open")}
          sub={t(lang, voted ? "home_vote_done_sub" : "home_vote_open_sub")}
          onClick={() => setTab("vote")}
          visual={
            <VisualBox>
              <span className="flex flex-col items-center gap-1">
                {[
                  { n: "12", size: "h-4 text-[10px]", cls: "bg-gradient-to-br from-gold to-orange text-dark-blue" },
                  { n: "10", size: "h-3.5 text-[9px]", cls: "bg-gradient-to-br from-flamingo to-fuchsia text-white" },
                  { n: "8", size: "h-3 text-[8px]", cls: "bg-white/[0.08] text-white/65 ring-1 ring-white/12" },
                ].map(({ n, size, cls }, i) => (
                  <motion.span
                    key={n}
                    initial={{ opacity: 0, scale: 0.3, y: -7 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ delay: 0.18 + i * 0.13, type: "spring", stiffness: 460, damping: 17 }}
                    className={`px-1.5 rounded-[5px] grid place-items-center font-display tabular-nums leading-none ${size} ${cls}`}
                  >
                    {n}
                  </motion.span>
                ))}
              </span>
            </VisualBox>
          }
        />
      )}

      {/* 3 — results (warm gold) */}
      {tallyEnabled && (
        <PromoWidget
          accent="linear-gradient(120deg, rgba(255,214,10,0.22), rgba(255,168,0,0.10) 50%, transparent)"
          eyebrow="🏆"
          title={t(lang, "home_results")}
          sub={t(lang, "home_results_sub")}
          onClick={() => window.dispatchEvent(new CustomEvent("uzk:open-results"))}
          visual={
            <VisualBox>
              <span className="flex flex-col items-center leading-none">
                <span className="text-base">🥇</span>
                <span className="text-sm -mt-0.5 flex gap-0.5"><span>🥈</span><span>🥉</span></span>
              </span>
            </VisualBox>
          }
        />
      )}

      {/* 4 — bingo (violet) */}
      <PromoWidget
        accent="linear-gradient(120deg, rgba(146,87,255,0.22), rgba(109,40,217,0.10) 55%, transparent)"
        eyebrow="BINGO"
        title={t(lang, "bingo_widget_title")}
        sub={
          bingo?.won
            ? t(lang, "home_bingo_won")
            : bingo
              ? t(lang, "home_bingo_progress", bingo.best)
              : t(lang, "home_bingo_sub")
        }
        onClick={() => setTab("bingo")}
        visual={
          <div className="grid grid-cols-3 gap-1 p-1.5 rounded-xl bg-black/30 ring-1 ring-white/12">
            {BINGO_PREVIEW.map((idx, i) => {
              const x = BINGO_PREVIEW_STRUCK.has(i);
              return (
                <span key={i} className="relative h-5 w-5 grid place-items-center text-[11px] leading-none rounded-md bg-white/[0.04]">
                  <span className={x ? "opacity-25 grayscale" : ""}>{tropeEmoji(idx)}</span>
                  {x && <span className="absolute inset-0 grid place-items-center text-flamingo text-[13px] font-bold leading-none">✕</span>}
                </span>
              );
            })}
          </div>
        }
      />
    </div>
  );
}

// The "now playing" hero card — built like the artist deep-dive: a
// press-kit photo (when we have one) with a flag-colour gradient, the
// heart-flag chip + country name + artist/song over it. Tap → the chat
// tab. Falls back to a colour-wash layout with no photo.
function PlayingCard({
  country,
  lang,
  pos,
  onOpen,
}: {
  country: NonNullable<ReturnType<typeof getCountry>>;
  lang: "en" | "lt";
  pos: number | null;
  onOpen: () => void;
}) {
  const [c1, c2] = countryColors(country.code);
  const photo = participantPhoto(country.code);
  const prog = pos != null ? Math.min(pos / GRAND_FINAL_ACTS, 1) : null;
  const eyebrow =
    pos != null ? `${t(lang, "now_playing")} · ${pos} / ${GRAND_FINAL_ACTS}` : t(lang, "now_playing");
  const progressBar =
    prog != null ? (
      <div className="absolute inset-x-0 bottom-0 h-[3px] bg-white/12">
        <div className="h-full bg-gradient-to-r from-flamingo to-fuchsia" style={{ width: `${prog * 100}%` }} />
      </div>
    ) : null;

  if (photo) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="w-full text-left rounded-3xl block"
        style={countryBorderStyle(c1, c2)}
      >
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
                {eyebrow}
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
          {progressBar}
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left rounded-3xl block"
      style={countryBorderStyle(c1, c2)}
    >
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
              {eyebrow}
            </p>
            <p className="font-display text-2xl text-white leading-tight truncate drop-shadow">
              {countryName(country.code, lang)}
            </p>
            <p className="text-sm text-white/75 leading-tight truncate mt-0.5">
              {country.artist}
              {country.song ? <span className="italic text-white/55"> · {country.song}</span> : null}
            </p>
          </div>
          <MessageCircle className="h-5 w-5 text-dark-blue-200 shrink-0" />
        </div>
        {progressBar}
      </div>
    </button>
  );
}
