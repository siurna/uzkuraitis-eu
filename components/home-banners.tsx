"use client";

import { useEffect, useState, type ReactNode, type CSSProperties } from "react";
import { MessageCircle } from "lucide-react";
import { useRoomLive, useRoomTab } from "@/components/room-shell";
import { getCountry, countryName } from "@/lib/countries";
import { countryColors } from "@/lib/country-colors";
import { participantPhoto } from "@/lib/participants";
import { optimizedSrc } from "@/lib/img";
import { buildBingoCard, FREE_SQUARE, tropeEmoji } from "@/lib/bingo-tropes";
import { HeartFlag } from "@/components/flag";
import { useLang, t } from "@/lib/i18n";

// ─────────────────────────────────────────────────────────────────────
// Home banners — full-width, but each its own object: a bold, multi-hue
// ESC-poster fill (the official site never uses a flat mono panel — it's
// blue→purple→fuchsia sweeps, golden→pink sunsets, deep-navy radials), a
// feature-specific graphic that bleeds off the right edge, copy laid over
// the left. Different fills, different heights, different artwork — no
// shared chrome, nothing to make them read interchangeable. The "now
// playing" hero is the photo headline up top; the rest follow.

// "#rrggbb" + alpha → "rgba(...)".
function hexA(hex: string, a: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

// A thick stroke in a country's own flag colours — the now-playing hero
// wears it instead of the generic rainbow.
function countryBorderStyle(c1: string, c2: string): CSSProperties {
  return { padding: "4px", backgroundImage: `linear-gradient(135deg, ${c1}, ${c2})` };
}

const SIZE_MIN_H: Record<"sm" | "md" | "lg", string> = {
  sm: "min-h-[5.5rem]",
  md: "min-h-[6.75rem]",
  lg: "min-h-[8.75rem]",
};

// The shared *shape* (deliberately spare so each banner's own fill +
// artwork do the differentiating). White-on-colour. No press scale / no
// hover state — they're surfaces, not buttons-pretending-to-be-cards.
function Banner({
  fill,
  size = "md",
  eyebrow,
  title,
  sub,
  artwork,
  onClick,
  dim = false,
}: {
  fill: string;
  size?: "sm" | "md" | "lg";
  eyebrow: ReactNode;
  title: ReactNode;
  sub: ReactNode;
  artwork: ReactNode;
  onClick: () => void;
  dim?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative block w-full overflow-hidden rounded-3xl text-left ${dim ? "opacity-85" : ""}`}
      style={{ background: fill }}
    >
      <div className="pointer-events-none absolute inset-y-0 -right-6 flex items-center">{artwork}</div>
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "linear-gradient(95deg, rgba(8,9,28,0.46) 0%, rgba(8,9,28,0.2) 38%, transparent 64%)" }}
      />
      <div className={`relative flex flex-col justify-center gap-1 px-5 py-5 ${SIZE_MIN_H[size]}`}>
        <p className="text-[10px] uppercase tracking-[0.3em] font-display leading-tight text-white/75 flex items-center gap-1.5">
          {eyebrow}
        </p>
        <p className="font-display text-xl text-white leading-tight drop-shadow-sm">{title}</p>
        <p className="text-sm text-white/70 leading-snug">{sub}</p>
      </div>
    </button>
  );
}

// A small "live" dot for the vote eyebrow when lines are open.
function LiveDot() {
  return (
    <span className="relative inline-flex h-1.5 w-1.5">
      <span className="absolute inline-flex h-full w-full rounded-full bg-white/80 opacity-75 motion-safe:animate-ping" />
      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
    </span>
  );
}

// Bingo: a 3×3 mini grid; a struck diagonal hints at the win condition.
const BINGO_PREVIEW = buildBingoCard("uzk-home-preview")
  .filter((i) => i !== FREE_SQUARE)
  .slice(0, 9);
const BINGO_PREVIEW_STRUCK = new Set([0, 4, 8]);

// Denominator for the now-playing progress bar — grand-final size.
const GRAND_FINAL_ACTS = 26;

// Side-bet artwork: a fanned spread of bet-flavour emoji "chips".
const BET_CHIPS = ["🏆", "🥄", "🎤", "⭐", "🎯"];

// Jump to a sub-tab inside the Vote screen (it owns its own ballot/bets/
// rules toggle). Small delay so the panel — lazily mounted on first
// visit — has attached its listener before the event fires.
function openVoteTab(setTab: (t: "vote") => void, sub: "ballot" | "bets" | "rules") {
  setTab("vote");
  window.setTimeout(() => window.dispatchEvent(new CustomEvent("uzk:vote-tab", { detail: sub })), 60);
}

export function HomeBanners() {
  const { code, votingEnabled, tallyEnabled, nowPlayingCode, showStatus, runningOrderPos } = useRoomLive();
  const lang = useLang();
  const { setTab } = useRoomTab();

  const [voted, setVoted] = useState(false);
  const [betsCount, setBetsCount] = useState(0);
  const [bingo, setBingo] = useState<{ best: number; won: boolean } | null>(null);
  const [vs, setVs] = useState<{ topCode: string; roomRank: number | null } | null>(null);

  useEffect(() => {
    setVoted(localStorage.getItem(`uzk_voted_${code}`) === "1");

    try {
      const tickets = JSON.parse(localStorage.getItem(`uzk_bingo_tickets_${code}`) ?? "[]") as {
        struck?: unknown[];
        bingoFired?: boolean;
      }[];
      if (Array.isArray(tickets) && tickets.length > 0) {
        const counts = tickets.map((tk) =>
          Math.min(25, (Array.isArray(tk.struck) ? tk.struck.length : 0) + 1),
        );
        setBingo({ best: Math.max(...counts), won: tickets.some((tk) => !!tk.bingoFired) });
      }
    } catch {
      /* ignore */
    }

    try {
      const bets = JSON.parse(localStorage.getItem(`uzk_bets_${code}`) ?? "{}") as Record<string, unknown>;
      let n = 0;
      for (const v of Object.values(bets)) {
        if (v == null) continue;
        if (Array.isArray(v)) { if (v.length) n++; }
        else n++;
      }
      if (localStorage.getItem(`uzk_home_${code}`)) n++; // home-country placement guess
      setBetsCount(n);
    } catch {
      /* ignore */
    }

    try {
      const ballot = JSON.parse(localStorage.getItem(`uzk_ballot_${code}`) ?? "[]") as {
        points?: number;
        countryCode?: string | null;
      }[];
      const top = Array.isArray(ballot) ? ballot.find((s) => s.points === 12)?.countryCode : null;
      if (top) {
        setVs({ topCode: top, roomRank: null });
        fetch(`/api/rooms/${code}/scores`, { cache: "no-store" })
          .then((r) => (r.ok ? r.json() : null))
          .then((data: { scores?: { code: string }[] } | null) => {
            const idx = data?.scores?.findIndex((s) => s.code === top) ?? -1;
            setVs({ topCode: top, roomRank: idx >= 0 ? idx + 1 : null });
          })
          .catch(() => {});
      }
    } catch {
      /* ignore */
    }
  }, [code]);

  const playing =
    showStatus === "in_progress" && nowPlayingCode ? getCountry(nowPlayingCode) : null;
  const vsCountry = vs ? getCountry(vs.topCode) : null;
  const vsRank = vs?.roomRank ?? null;
  const vsSub = !vsCountry
    ? t(lang, "home_vs_room_empty_sub")
    : vsRank == null
      ? t(lang, "home_vs_room_pending")
      : vsRank === 1
        ? t(lang, "home_vs_room_agree")
        : vsRank >= 12
          ? t(lang, "home_vs_room_bold", vsRank)
          : t(lang, "home_vs_room_rank", vsRank);

  return (
    <div className="container mx-auto max-w-3xl px-4 flex flex-col gap-3">
      {/* the headline — who's on stage right now */}
      {playing && (
        <PlayingCard country={playing} lang={lang} pos={runningOrderPos} onOpen={() => setTab("chat")} />
      )}

      {/* Vote — electric-blue → purple, a cascade of "douze points" pills */}
      <Banner
        fill="linear-gradient(135deg, #0040ee 0%, #6020c6 55%, #7d1f9a 100%)"
        size="lg"
        eyebrow={
          voted
            ? t(lang, "home_vote_done_eyebrow")
            : votingEnabled
              ? <><LiveDot />{t(lang, "live")}</>
              : t(lang, "tab_ballot")
        }
        title={t(lang, voted ? "home_vote_done" : votingEnabled ? "home_vote_open" : "home_vote_soon")}
        sub={t(lang, voted ? "home_vote_done_sub" : votingEnabled ? "home_vote_open_sub" : "home_vote_soon_sub")}
        onClick={() => setTab("vote")}
        artwork={
          <span className="flex flex-col items-end gap-1.5 pr-9 -rotate-[8deg] opacity-90">
            {[
              { n: "12", w: "w-12", cls: "bg-yellow text-dark-blue" },
              { n: "10", w: "w-10", cls: "bg-white text-dark-blue" },
              { n: "8", w: "w-9", cls: "bg-white/70 text-dark-blue" },
              { n: "7", w: "w-7", cls: "bg-white/35 text-white" },
              { n: "6", w: "w-6", cls: "bg-white/20 text-white" },
            ].map(({ n, w, cls }) => (
              <span
                key={n}
                className={`h-5 ${w} rounded-md grid place-items-center font-display text-[11px] tabular-nums leading-none shadow-sm ${cls}`}
              >
                {n}
              </span>
            ))}
          </span>
        }
      />

      {/* Bingo — purple → magenta, the ticket grid bleeding off the edge */}
      <Banner
        fill="linear-gradient(135deg, #5a22a9 0%, #9b1690 50%, #c91475 100%)"
        size="lg"
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
        artwork={
          <span className="grid grid-cols-3 gap-1.5 pr-9 -rotate-[8deg] opacity-95">
            {BINGO_PREVIEW.map((idx, i) => {
              const x = BINGO_PREVIEW_STRUCK.has(i);
              return (
                <span
                  key={i}
                  className="relative h-9 w-9 grid place-items-center text-lg leading-none rounded-lg bg-white/12 ring-1 ring-white/15"
                >
                  <span className={x ? "opacity-30 grayscale" : ""}>{tropeEmoji(idx)}</span>
                  {x && <span className="absolute inset-0 grid place-items-center text-white text-xl font-bold leading-none">✕</span>}
                </span>
              );
            })}
          </span>
        }
      />

      {/* Bonus bets — magenta → ESC pink, a fanned spread of bet "chips" */}
      <Banner
        fill="linear-gradient(135deg, #bc1475 0%, #f10d59 100%)"
        size="sm"
        eyebrow={t(lang, "rules_bets_h")}
        title={betsCount > 0 ? t(lang, "home_bonus_placed", betsCount) : t(lang, "home_bonus_none")}
        sub={t(lang, "home_bonus_sub")}
        onClick={() => openVoteTab(setTab, "bets")}
        artwork={
          <span className="relative block w-32 h-20 pr-6">
            {BET_CHIPS.map((c, i) => (
              <span
                key={c}
                className="absolute top-1/2 grid h-11 w-11 place-items-center rounded-xl bg-white/15 ring-1 ring-white/20 text-xl shadow-md"
                style={{
                  left: `${i * 17}px`,
                  transform: `translateY(-50%) rotate(${(i - 2) * 7}deg)`,
                  zIndex: i,
                }}
              >
                {c}
              </span>
            ))}
          </span>
        }
      />

      {/* You vs the room — deep-space radial, your #1 flag + a two-bar chart */}
      <Banner
        fill="radial-gradient(150% 130% at 88% -8%, #2a17e6 0%, #0a0d52 28%, #060a3e 55%, #3e0f54 88%)"
        size="md"
        dim={!vsCountry}
        eyebrow={t(lang, "home_vs_room")}
        title={vsCountry ? countryName(vsCountry.code, lang) : t(lang, "home_vs_room_empty_title")}
        sub={vsSub}
        onClick={() => setTab("vote")}
        artwork={
          vsCountry ? (
            <span className="flex items-center gap-3 pr-9">
              <span className="flex items-end gap-1.5 h-16">
                <span className="w-3 rounded-t bg-white" style={{ height: "100%" }} title="your #1" />
                <span
                  className="w-3 rounded-t bg-white/35"
                  style={{ height: `${Math.max(14, 100 - ((vsRank ?? 10) - 1) * 9)}%` }}
                  title="the room"
                />
              </span>
              <span className="-rotate-6 drop-shadow">
                <HeartFlag code={vsCountry.code} size="lg" />
              </span>
            </span>
          ) : (
            <span className="pr-12 text-7xl opacity-25 -rotate-6 select-none" aria-hidden>
              📊
            </span>
          )
        }
      />
    </div>
  );
}

// The "now playing" hero — a press-kit photo with a flag-colour gradient,
// the heart-flag chip + name + artist/song over it, and a progress bar
// (running order) along the bottom. Tap → chat. Falls back to a
// colour-wash layout when there's no photo. Wears a thick flag-colour
// stroke.
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
  const prog = pos != null ? Math.min(Math.max(pos, 0) / GRAND_FINAL_ACTS, 1) : 0;
  const eyebrow =
    pos != null ? `${t(lang, "now_playing")} · ${pos} / ${GRAND_FINAL_ACTS}` : t(lang, "now_playing");
  // Always-present track so the "progress lives here" affordance reads,
  // even before the host sets the running-order position (then it's 0%).
  const progressBar = (
    <div className="absolute inset-x-0 bottom-0 h-1 bg-black/35">
      <div
        className="h-full bg-gradient-to-r from-flamingo to-fuchsia shadow-[0_0_12px_oklch(70.55%_0.2725_336.19_/_0.7)]"
        style={{ width: `${prog * 100}%` }}
      />
    </div>
  );

  if (photo) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="w-full text-left rounded-3xl block"
        style={countryBorderStyle(c1, c2)}
      >
        <div className="relative overflow-hidden rounded-[20px] aspect-[16/10] sm:aspect-[2/1]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={optimizedSrc(photo, 1200)} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(110deg, ${hexA(c1, 0.5)}, ${hexA(c2, 0.28)} 45%, transparent 70%), linear-gradient(0deg, rgba(8,9,28,0.92), rgba(8,9,28,0.1) 55%, transparent)`,
            }}
          />
          <div className="absolute inset-x-0 bottom-0 p-4 pb-5 sm:p-5 sm:pb-6 flex items-end gap-3">
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
        className="relative overflow-hidden rounded-[20px] px-5 pt-5 pb-6 sm:px-6"
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
