"use client";

import { useEffect, useState, type ReactNode, type CSSProperties } from "react";
import { motion, AnimatePresence, useScroll, useTransform } from "motion/react";
import { MessageCircle, ChevronRight } from "lucide-react";
import { useRoomLive, useRoomTab } from "@/components/room-shell";
import { getCountry, countryName } from "@/lib/countries";
import { countryColors } from "@/lib/country-colors";
import { participantPhoto } from "@/lib/participants";
import { optimizedSrc } from "@/lib/img";
import { buildBingoCard, FREE_SQUARE, tropeEmoji, tropeText } from "@/lib/bingo-tropes";
import { HeartFlag } from "@/components/flag";
import { FluentEmoji } from "@/components/fluent-emoji";
import { MyResults } from "@/components/my-results";
import { t, type Language } from "@/lib/i18n";
import { useLang } from "@/lib/i18n-client";

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
  /** Tap target. Omit to render a non-interactive surface. */
  onClick?: () => void;
  dim?: boolean;
}) {
  const inner = (
    <>
      <div className="pointer-events-none absolute inset-y-0 -right-6 flex items-center">{artwork}</div>
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "linear-gradient(95deg, rgba(8,9,28,0.46) 0%, rgba(8,9,28,0.2) 38%, transparent 64%)" }}
      />
      {/* The right ~38% is reserved for the artwork so copy never sits
          on top of it (matches the wash that fades out at ~68%). The
          extra ~4% over the previous pr-[34%] tightens the description
          column so longer subs (the Bingo crossfade especially) wrap
          to evenly-balanced lines instead of stretching into the
          artwork's wash. `text-balance` on the sub gets us the even
          last-line shape. */}
      <div className={`relative flex flex-col justify-center gap-1 pl-5 pr-[38%] py-5 ${SIZE_MIN_H[size]}`}>
        <p className="text-[10px] uppercase tracking-[0.3em] font-display leading-tight text-white/75 flex items-center gap-1.5">
          {eyebrow}
        </p>
        <p className="font-display text-xl text-white leading-tight drop-shadow-sm text-balance">{title}</p>
        <p className="text-sm text-white/70 leading-snug text-balance">{sub}</p>
      </div>
    </>
  );
  const cls = `relative block w-full overflow-hidden rounded-3xl text-left ${dim ? "opacity-85" : ""}`;
  if (!onClick) {
    return <div className={cls} style={{ background: fill }}>{inner}</div>;
  }
  return (
    <button type="button" onClick={onClick} className={cls} style={{ background: fill }}>
      {inner}
    </button>
  );
}

// Vote artwork: a five-bar audio equalizer in the points colours
// (12 = gold, then white fading down), each bar dancing on its own
// loop. Reads as "the room is making noise" + "this is where points
// happen".
function VoteEqualizer() {
  const BARS = [
    { n: "12", grad: "from-yellow to-yellow/50", dur: "0.9s",  delay: "0s"    },
    { n: "10", grad: "from-white to-white/65",   dur: "1.15s", delay: "0.18s" },
    { n: "8",  grad: "from-white/80 to-white/40", dur: "0.8s", delay: "0.34s" },
    { n: "7",  grad: "from-white/55 to-white/25", dur: "1.3s", delay: "0.06s" },
    { n: "6",  grad: "from-white/40 to-white/15", dur: "1.0s", delay: "0.46s" },
  ];
  return (
    <span className="flex items-end gap-2 pr-10 -rotate-[6deg] opacity-95" aria-hidden>
      {BARS.map(({ n, grad, dur, delay }) => (
        <span key={n} className="flex w-5 flex-col items-center gap-1">
          <span className="relative h-16 w-full overflow-hidden rounded-t-md bg-white/10 ring-1 ring-white/10">
            <span
              className={`absolute inset-x-0 bottom-0 h-full rounded-t-md bg-gradient-to-t ${grad}`}
              style={{ transformOrigin: "bottom", animation: `uzk-eq ${dur} ease-in-out ${delay} infinite` }}
            />
          </span>
          <span className="font-display text-[9px] tabular-nums leading-none text-white/80">{n}</span>
        </span>
      ))}
    </span>
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

// Bingo banner subtitle: slowly crossfade through the player's actual
// ticket tropes (every ~10s) so it teases the game's flavour rather than
// sitting on a static "marked x/y" line. Falls back to a preview deck
// when the player hasn't generated a ticket yet.
function BingoSubCrossfade({ lang, tropes }: { lang: Language; tropes: readonly number[] }) {
  const list = tropes.length > 0 ? tropes : BINGO_PREVIEW;
  const [i, setI] = useState(0);
  useEffect(() => {
    setI(0);
    const id = window.setInterval(() => setI((n) => (n + 1) % list.length), 10000);
    return () => window.clearInterval(id);
  }, [list.length]);
  const idx = list[i % list.length] ?? list[0];
  return (
    <span className="inline-block min-h-[1.2em] align-bottom">
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={`${i}-${idx}`}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.32 }}
          className="block"
        >
          {tropeText(idx, lang)}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

// Denominator for the now-playing progress bar — grand-final size.
const GRAND_FINAL_ACTS = 26;

// Side-bet artwork: a marching strip of bet-flavour emoji "chips" — one
// per bonus bet (winner, wooden spoon, jury/televote, host top-3, LT's
// 12 points, nul-points, the LT total points line). The two marquees
// below use the top sequence and a shuffled copy on the bottom so when
// they cross paths in the middle of the banner no two columns ever
// share the same chip — the eye reads "real motion" instead of a
// regular pattern.
const BET_CHIPS = ["🏆", "🥄", "🎤", "⭐", "🎯", "0️⃣", "🇱🇹"];
const BET_CHIPS_REV = ["🥄", "🎯", "🇱🇹", "🏆", "0️⃣", "🎤", "⭐"];

// Jump to a sub-tab inside the Vote screen (it owns its own ballot/bets/
// rules toggle). Small delay so the panel — lazily mounted on first
// visit — has attached its listener before the event fires.
function openVoteTab(setTab: (t: "vote") => void, sub: "ballot" | "bets" | "rules") {
  setTab("vote");
  window.setTimeout(() => window.dispatchEvent(new CustomEvent("uzk:vote-tab", { detail: sub })), 60);
}

// Shared enter/exit/layout choreography for every home banner — so a
// widget appearing or disappearing (now-playing, results, share, …)
// slides in/out rather than popping, and its neighbours reflow smoothly.
const BANNER_MOTION = {
  layout: true,
  initial: { opacity: 0, y: 12, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
  transition: { type: "spring" as const, stiffness: 360, damping: 32 },
};

export function HomeBanners() {
  const { code, votingEnabled, nowPlayingCode, showStatus, runningOrderPos } = useRoomLive();
  const lang = useLang();
  const { setTab } = useRoomTab();

  const [voted, setVoted] = useState(false);
  const [betsCount, setBetsCount] = useState(0);
  const [bingo, setBingo] = useState<{ best: number; won: boolean } | null>(null);
  const [ticketTropes, setTicketTropes] = useState<number[]>([]);
  const [vs, setVs] = useState<{ topCode: string; roomRank: number | null; overlap: number | null } | null>(null);

  useEffect(() => {
    setVoted(localStorage.getItem(`uzk_voted_${code}`) === "1");

    try {
      const tickets = JSON.parse(localStorage.getItem(`uzk_bingo_tickets_${code}`) ?? "[]") as {
        struck?: unknown[];
        bingoFired?: boolean;
        seed?: string;
      }[];
      if (Array.isArray(tickets) && tickets.length > 0) {
        const counts = tickets.map((tk) =>
          Math.min(25, (Array.isArray(tk.struck) ? tk.struck.length : 0) + 1),
        );
        setBingo({ best: Math.max(...counts), won: tickets.some((tk) => !!tk.bingoFired) });
        // Collect the trope indices on every ticket the player holds — the
        // banner subtitle crossfades through them.
        const set = new Set<number>();
        for (const tk of tickets) {
          if (typeof tk.seed !== "string") continue;
          for (const tr of buildBingoCard(tk.seed)) if (tr !== FREE_SQUARE) set.add(tr);
        }
        setTicketTropes([...set]);
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
      const sorted = Array.isArray(ballot)
        ? [...ballot].sort((a, b) => (b.points ?? 0) - (a.points ?? 0))
        : [];
      const top5 = sorted.slice(0, 5).map((s) => s.countryCode).filter((c): c is string => !!c);
      const top = sorted.find((s) => s.points === 12)?.countryCode ?? top5[0] ?? null;
      if (top) {
        setVs({ topCode: top, roomRank: null, overlap: null });
        fetch(`/api/rooms/${code}/scores`, { cache: "no-store" })
          .then((r) => (r.ok ? r.json() : null))
          .then((data: { scores?: { code: string }[] } | null) => {
            const scores = data?.scores ?? [];
            const idx = scores.findIndex((s) => s.code === top);
            const roomTop10 = new Set(scores.slice(0, 10).map((s) => s.code));
            const overlap = top5.filter((c) => roomTop10.has(c)).length;
            setVs({ topCode: top, roomRank: idx >= 0 ? idx + 1 : null, overlap: scores.length ? overlap : null });
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
  const vsOverlap = vs?.overlap ?? null;
  const vsSub = !vsCountry
    ? t(lang, "home_vs_room_empty_sub")
    : vsRank == null
      ? t(lang, "home_vs_room_pending")
      : vsRank === 1
        ? t(lang, "home_vs_room_agree")
        : vsOverlap != null && vsOverlap >= 4
          ? t(lang, "home_vs_room_wavelength", vsOverlap)
          : vsOverlap != null && vsOverlap <= 1
            ? t(lang, "home_vs_room_outlier")
            : vsRank >= 12
              ? t(lang, "home_vs_room_bold", vsRank)
              : t(lang, "home_vs_room_rank", vsRank);

  // What lives in the big top slot:
  //   - someone on stage   → the now-playing hero
  //   - else, lines open   → a Vote hero (cast OR adjust, copy adapts)
  //   - else nothing
  const showVoteHero = !playing && votingEnabled;
  // "Your vote is in" small banner: ONLY while voting is actively
  // happening AND the viewer has cast. After lines close the banner
  // serves no purpose (the ballot is final), so hide it entirely.
  const showVoteBanner = voted && votingEnabled && !showVoteHero;
  // Bonus banner is purely an editable surface — there's nothing to do
  // once lines close, and the leaderboard reveal carries the scoring.
  // Hide it the moment voting is off, even if the viewer already has
  // bets down.
  const showBonusBanner = votingEnabled;

  return (
    <div className="container mx-auto max-w-3xl px-4 flex flex-col gap-3">
      <AnimatePresence mode="popLayout" initial={false}>
        {/* Top slot — who's on stage, or a VOTE NOW hero, or nothing */}
        {playing ? (
          <motion.div key="np-hero" {...BANNER_MOTION}>
            <PlayingCard country={playing} lang={lang} pos={runningOrderPos} onOpen={() => setTab("chat")} />
          </motion.div>
        ) : showVoteHero ? (
          <motion.div key="vote-hero" {...BANNER_MOTION}>
            <VoteHeroCard
              lang={lang}
              voted={voted}
              onOpen={() => setTab("vote")}
            />
          </motion.div>
        ) : null}

        {/* Results widget — first card UNDER the now-playing / vote
            hero. Self-hides when tally isn't on. */}
        <motion.div key="my-results-inline" {...BANNER_MOTION}>
          <MyResults />
        </motion.div>

        {/* Vote — electric-blue → purple */}
        {showVoteBanner && (
          <motion.div key="vote-banner" {...BANNER_MOTION}>
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
              title={t(lang, voted ? "home_vote_done" : "home_vote_open")}
              sub={t(lang, voted ? "home_vote_done_sub" : "home_vote_open_sub")}
              onClick={() => setTab("vote")}
              artwork={<VoteEqualizer />}
            />
          </motion.div>
        )}

        {/* Bingo — purple → magenta, the ticket grid bleeding off the edge */}
        <motion.div key="bingo-banner" {...BANNER_MOTION}>
          <Banner
            fill="linear-gradient(135deg, #5a22a9 0%, #9b1690 50%, #c91475 100%)"
            size="lg"
            eyebrow="BINGO"
            title={t(lang, "bingo_widget_title")}
            sub={
              bingo?.won
                ? t(lang, "home_bingo_won")
                : <BingoSubCrossfade lang={lang} tropes={ticketTropes} />
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
                      <span className={x ? "opacity-30 grayscale" : ""}>
                        <FluentEmoji glyph={tropeEmoji(idx)} size={22} />
                      </span>
                      {x && <span className="absolute inset-0 grid place-items-center text-white text-xl font-bold leading-none">✕</span>}
                    </span>
                  );
                })}
              </span>
            }
          />
        </motion.div>

        {/* You vs the room — deep-space radial. Copy on the left,
            heart-flag on the right. The bars are gone — the
            "ranks #X" line in the sub already carries the comparison.
        */}
        <motion.div key="vs-banner" {...BANNER_MOTION}>
          <VsRoomCard
            lang={lang}
            country={vsCountry}
            sub={vsSub}
            // No-op when lines are shut — there's nothing to do over on the Vote tab.
            onClick={votingEnabled ? () => setTab("vote") : undefined}
          />
        </motion.div>

        {/* Bonus bets — magenta → ESC pink, an endless marquee of bet "chips" */}
        {showBonusBanner && (
          <motion.div key="bonus-banner" {...BANNER_MOTION}>
            <Banner
              fill="linear-gradient(135deg, #bc1475 0%, #f10d59 100%)"
              size="sm"
              eyebrow={t(lang, "rules_bets_h")}
              title={betsCount > 0 ? t(lang, "home_bonus_placed", betsCount) : t(lang, "home_bonus_none")}
              sub={t(lang, "home_bonus_sub")}
              onClick={() => openVoteTab(setTab, "bets")}
              artwork={
                // Stacked confetti-ish layout: two short marquees in
                // opposite directions instead of one rotated strip. The
                // rotation was creating a diagonal hard-cut against the
                // banner's bottom edge; this reads tidier inside the
                // rounded box.
                <span
                  className="relative block w-44 h-24 overflow-hidden
                             [mask-image:linear-gradient(90deg,transparent,#000_18%,#000_82%,transparent)]"
                  aria-hidden
                >
                  <span
                    className="absolute top-1 left-0 flex w-max"
                    style={{ animation: "uzk-marquee 22s linear infinite" }}
                  >
                    {[...BET_CHIPS, ...BET_CHIPS].map((c, i) => (
                      <span
                        key={`top-${i}`}
                        className="mr-2 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/15 ring-1 ring-white/20 shadow-md"
                      >
                        <FluentEmoji glyph={c} size={22} />
                      </span>
                    ))}
                  </span>
                  <span
                    className="absolute bottom-1 left-0 flex w-max"
                    style={{ animation: "uzk-marquee 28s linear infinite reverse" }}
                  >
                    {[...BET_CHIPS_REV, ...BET_CHIPS_REV].map((c, i) => (
                      <span
                        key={`bot-${i}`}
                        className="mr-2 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/15 ring-1 ring-white/20 shadow-md"
                      >
                        <FluentEmoji glyph={c} size={22} />
                      </span>
                    ))}
                  </span>
                </span>
              }
            />
          </motion.div>
        )}

      </AnimatePresence>
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
  // Gentle parallax: the photo lags the page scroll a touch.
  const { scrollY } = useScroll();
  const photoY = useTransform(scrollY, [0, 700], [-14, 14]);
  const prog = pos != null ? Math.min(Math.max(pos, 0) / GRAND_FINAL_ACTS, 1) : 0;
  const eyebrow =
    pos != null ? `${t(lang, "now_playing")} · ${pos} / ${GRAND_FINAL_ACTS}` : t(lang, "now_playing");
  // Always-present track so the "progress lives here" affordance reads,
  // even before the host sets the running-order position (then it's 0%).
  // The fill slides when the running-order position advances.
  const progressBar = (
    <div className="absolute inset-x-0 bottom-0 h-1 bg-black/35">
      <motion.div
        className="h-full bg-gradient-to-r from-flamingo to-fuchsia shadow-[0_0_12px_oklch(70.55%_0.2725_336.19_/_0.7)]"
        animate={{ width: `${prog * 100}%` }}
        transition={{ type: "spring", stiffness: 90, damping: 18 }}
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
          {/* parallax photo — oversized so the scroll shift never bares an edge */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <motion.img
            key={photo}
            src={optimizedSrc(photo, 1200)}
            alt=""
            style={{ y: photoY }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="absolute inset-x-0 -top-[14%] h-[128%] w-full object-cover"
          />
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(110deg, ${hexA(c1, 0.5)}, ${hexA(c2, 0.28)} 45%, transparent 70%), linear-gradient(0deg, rgba(8,9,28,0.92), rgba(8,9,28,0.1) 55%, transparent)`,
            }}
          />
          <motion.div
            key={country.code}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-x-0 bottom-0 p-4 pb-5 sm:p-5 sm:pb-6 flex items-end gap-3"
          >
            <span className="shrink-0">
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
          </motion.div>
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
          <span className="shrink-0">
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

// The Vote hero — shown whenever the lines are open and nobody is on
// stage. Same prominence as the now-playing hero: full-width, rainbow-
// stroked, equalizer art bleeding off the right. Copy adapts to whether
// you've already cast — the hero stays up either way so adjusting your
// TOP 10 mid-show is still a single tap from Home.
function VoteHeroCard({
  lang,
  voted,
  onOpen,
}: {
  lang: "en" | "lt";
  voted: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      // Animated rainbow stroke — same brand colours, looping L→R so
      // the border reads as "live" without being garish.
      className="rainbow-border-anim rounded-3xl w-full block text-left"
    >
      <div
        className="relative overflow-hidden rounded-[22px] px-5 pt-5 pb-5 sm:px-6 min-h-[8.75rem] flex flex-col items-start gap-3"
        style={{ background: "linear-gradient(125deg, #f10d59 0%, #ff3ede 46%, #6020c6 100%)" }}
      >
        <div className="pointer-events-none absolute inset-y-0 -right-5 flex items-center">
          <VoteEqualizer />
        </div>
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "linear-gradient(95deg, rgba(8,9,28,0.5) 0%, rgba(8,9,28,0.22) 40%, transparent 66%)" }}
        />
        <div className="relative flex flex-col items-start gap-1 pr-[34%] text-left">
          <p className="text-[10px] uppercase tracking-[0.32em] text-white/85 font-display leading-tight flex items-center gap-1.5">
            <LiveDot />
            {t(lang, "live")}
          </p>
          <p className="font-display text-2xl text-white leading-tight drop-shadow text-balance">
            {t(lang, voted ? "home_vote_done" : "home_vote_open")}
          </p>
          <p className="text-sm text-white/75 leading-snug">
            {t(lang, voted ? "home_vote_done_sub" : "home_vote_open_sub")}
          </p>
        </div>
        {/* Explicit CTA pill — reads as an action, not just "the card
            is a button". White-on-flamingo so it pops off the
            gradient; pointer-events:none means the outer button still
            owns the tap target. */}
        <span
          className="relative pointer-events-none inline-flex items-center gap-1.5
                     h-9 px-4 rounded-xl bg-white text-dark-blue font-display text-sm"
        >
          {t(lang, voted ? "sys_cta_vote_btn_adjust" : "sys_cta_vote_btn_cast")}
          <ChevronRight className="h-4 w-4" />
        </span>
      </div>
    </button>
  );
}

// You-vs-the-room widget. Copy on the left, the heart-flag on the
// right. The earlier iteration had a two-bar "you vs the room" chart
// next to the flag — it read as filler chart-junk next to the copy
// that already said "the room ranks it #X". The number lives in the
// sub now, the flag carries the country identity.
function VsRoomCard({
  lang,
  country,
  sub,
  onClick,
}: {
  lang: Language;
  country: ReturnType<typeof getCountry> | null;
  sub: ReactNode;
  onClick?: () => void;
}) {
  const body = (
    <div
      className="relative overflow-hidden rounded-3xl px-5 py-5"
      style={{
        background:
          "radial-gradient(150% 130% at 88% -8%, #2a17e6 0%, #0a0d52 28%, #060a3e 55%, #3e0f54 88%)",
      }}
    >
      <div className="flex items-center gap-4">
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <p className="text-[10px] uppercase tracking-[0.3em] font-display leading-tight text-white/75">
            {t(lang, "home_vs_room")}
          </p>
          <p className="font-display text-xl text-white leading-tight drop-shadow-sm text-balance">
            {country ? countryName(country.code, lang) : t(lang, "home_vs_room_empty_title")}
          </p>
          <p className="text-sm text-white/70 leading-snug text-balance">{sub}</p>
        </div>
        {country ? (
          <span className="shrink-0 -rotate-6 drop-shadow-lg scale-125 origin-center mr-1">
            <HeartFlag code={country.code} size="lg" />
          </span>
        ) : (
          <span className="opacity-30 -rotate-6 select-none shrink-0 mr-2" aria-hidden>
            <FluentEmoji glyph="📊" size={72} />
          </span>
        )}
      </div>
    </div>
  );
  const cls = `relative block w-full text-left ${country ? "" : "opacity-85"}`;
  if (!onClick) return <div className={cls}>{body}</div>;
  return (
    <button type="button" onClick={onClick} className={cls}>
      {body}
    </button>
  );
}
