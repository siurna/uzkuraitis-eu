"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Flame } from "lucide-react";
import { useEventListener } from "@/lib/realtime";
import { useRoomLive } from "@/components/room-shell";
import { FluentEmoji } from "@/components/fluent-emoji";
import { getAvatar } from "@/lib/avatars";
import { getCountry, countryName } from "@/lib/countries";
import { optimizedSrc } from "@/lib/img";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { t } from "@/lib/i18n";
import { useLang } from "@/lib/i18n-client";

type Highlight = {
  id: string;
  name: string;
  avatarId: string | null;
  kind: string;
  body: string | null;
  gifUrl: string | null;
  meta: Record<string, unknown> | null;
  reactionCount: number;
};

// Home widget: the chat moments that blew up.
//
// Layout: a section title at the top, then a full-width "trophy card"
// showing the single hottest line — author, body / GIF, reaction count
// — designed to read as a keepsake worth quoting later. A "More N"
// button below opens a drawer with every highlight from the night.
// Self-hides if empty.
export function Highlights() {
  const { code } = useRoomLive();
  const lang = useLang();
  const [items, setItems] = useState<Highlight[]>([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/rooms/${code}/highlights`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { highlights: Highlight[] };
      setItems(data.highlights ?? []);
    } catch {
      /* network blip */
    }
  }, [code]);

  useEffect(() => {
    load();
  }, [load]);

  // Highlights are a derived view of "messages with ≥ threshold
  // reactions". A fresh chat:new never qualifies on its own; only
  // chat:react and chat:delete can change the set. Throttle to one
  // refetch per 5s so a reaction storm doesn't slam the GET with N
  // viewers × M reactions/min. The endpoint is already SWR-cached,
  // but the round-trip JS + parse still costs every client.
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEventListener(({ event }) => {
    if (event.type !== "chat:react" && event.type !== "chat:delete") return;
    if (highlightTimer.current) return;
    highlightTimer.current = setTimeout(() => {
      highlightTimer.current = null;
      load();
    }, 5_000);
  });

  // Crossfade through the top 3 highlights every ~5.5s so the widget
  // feels like a rotating "best of the night" reel instead of a static
  // first-place pin. When there are fewer than 2 highlights, the
  // timer is skipped — nothing to rotate to.
  const rotation = items.slice(0, 3);
  const [rotIdx, setRotIdx] = useState(0);
  useEffect(() => {
    if (rotation.length < 2) return;
    const id = window.setInterval(() => {
      setRotIdx((i) => (i + 1) % rotation.length);
    }, 5500);
    return () => window.clearInterval(id);
  }, [rotation.length]);
  // Clamp on length shrink (a highlight got deleted, say) so we don't
  // index past the end of a shorter rotation array.
  const safeIdx = rotIdx % Math.max(rotation.length, 1);

  if (items.length === 0) return null;

  // For text-y highlights only — `body?.trim()` for chat lines,
  // the bingo emoji for strikes, EMPTY for GIF / image moments
  // (those render their picture inline; "GIF" placeholder text
  // sitting next to the actual image read as a duplicate label).
  const preview = (h: Highlight): string =>
    h.kind === "bingo_strike" ? `🎯 ${t(lang, "bingo_strike_label")}` : h.body?.trim() ?? "";
  const top = rotation[safeIdx] ?? items[0];
  const topPreview = preview(top);
  const topAvatar = top.avatarId ? getAvatar(top.avatarId) : null;
  const topNp = (top.meta as { nowPlaying?: string } | null)?.nowPlaying;
  const topCountry = topNp ? getCountry(topNp) : null;
  const rest = items.length - 1;

  return (
    <div className="container mx-auto max-w-3xl px-4">
      {/* One self-contained widget: title baked in at the top (eyebrow
          row), the trophy card body, and a "+N daugiau" affordance
          pinned to the bottom-right of the card. Tap anywhere to open
          the full gallery. */}
      <motion.button
        type="button"
        onClick={() => setOpen(true)}
        initial={{ opacity: 0, y: 12, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 360, damping: 32 }}
        className="relative block w-full overflow-hidden rounded-3xl text-left text-balance
                   shadow-[0_18px_44px_-18px_oklch(58%_0.18_42_/_0.55),inset_0_1px_0_rgba(255,255,255,0.18)]
                   ring-1 ring-white/8"
        style={{ background: "linear-gradient(135deg, #ff8a2a 0%, #ef1f3f 52%, #b1146a 100%)" }}
      >
        {/* Subtle fire animation in the background. Three radial blobs
            drift up + fade independently; sits below the gloss + content
            so they only read as a warm glow, never as foreground. */}
        <span className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          <span className="absolute inset-x-0 bottom-0 h-full fire-blob fire-blob-a" />
          <span className="absolute inset-x-0 bottom-0 h-full fire-blob fire-blob-b" />
          <span className="absolute inset-x-0 bottom-0 h-full fire-blob fire-blob-c" />
        </span>
        {/* Soft top-light strip (the skeuo gloss) */}
        <span
          className="pointer-events-none absolute inset-x-0 top-0 h-1/2"
          style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.20) 0%, transparent 70%)" }}
          aria-hidden
        />
        {/* Static chrome (eyebrow + "+N more" footer) sits OUTSIDE the
            AnimatePresence so it doesn't blink with each crossfade.
            Only the changing pieces — reaction count, quote / GIF,
            avatar + author + country — get keyed by the active
            highlight's id and tween between rotations. */}
        <div className="relative flex flex-col gap-3 p-5">
          {/* Top row — eyebrow stays put, reaction count crossfades
              with the rest of the highlight content. */}
          <div className="flex items-center gap-2">
            <p className="text-[10px] uppercase tracking-[0.3em] text-white/95 font-display leading-tight flex items-center gap-1.5">
              <Flame
                className="h-3 w-3"
                fill="#3a1505"
                style={{ color: "#3a1505" }}
              />
              {t(lang, "highlights_title")}
            </p>
            <span className="ml-auto shrink-0">
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={`react-${top.id}`}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                  className="inline-flex items-center gap-1 rounded-full
                             bg-white/25 ring-1 ring-white/40 px-2.5 h-6
                             text-xs text-white tabular-nums font-display"
                >
                  <FluentEmoji glyph="❤️" size={12} />
                  {top.reactionCount}
                </motion.span>
              </AnimatePresence>
            </span>
          </div>

          {/* Quote + (optional) GIF crossfade as one block — both
              re-key on top.id and slide in together. */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`body-${top.id}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col gap-3"
            >
              {topPreview && (
                <p className="font-display text-2xl text-white leading-snug text-balance drop-shadow-sm line-clamp-3 pr-20">
                  {/* Locale-aware quotes: Lithuanian uses „low-9 + left
                      open“ (U+201E + U+201C), English uses the curly
                      pair “…” (U+201C + U+201D). The card's text body
                      is the user's own quote, but the punctuation
                      around it should follow the reader's language. */}
                  {lang === "lt" ? "„" : "“"}
                  {topPreview}
                  {lang === "lt" ? "“" : "”"}
                </p>
              )}
              {top.gifUrl && top.kind !== "bingo_strike" && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={top.gifUrl}
                  alt=""
                  className="rounded-xl ring-1 ring-white/20 max-h-44 w-auto self-start"
                />
              )}
            </motion.div>
          </AnimatePresence>

          {/* Author row — avatar + name + country crossfade together,
              but the trailing "+N daugiau" footer stays static because
              its number is a count of TOTAL highlights, not a fact
              about the currently-shown one. */}
          <div className="flex items-center gap-2">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={`author-${top.id}`}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                className="flex-1 min-w-0 flex items-center gap-2"
              >
                <span className="h-7 w-7 shrink-0 rounded-lg overflow-hidden ring-1 ring-white/30 bg-dark-blue-800">
                  {topAvatar?.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={optimizedSrc(topAvatar.photo, 64)}
                      alt=""
                      className="h-full w-full object-cover"
                      style={{
                        objectPosition: topAvatar.focal
                          ? `${topAvatar.focal.x}% ${topAvatar.focal.y}%`
                          : "50% 30%",
                      }}
                    />
                  ) : (
                    <span className="h-full w-full grid place-items-center font-display text-[11px] text-white bg-white/15">
                      {top.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </span>
                <p className="flex-1 min-w-0 text-xs text-white/85 truncate leading-tight">
                  <span className="font-display">{top.name}</span>
                  {topCountry && (
                    <span className="text-white/65">
                      {" · "}
                      {topCountry.flag} {countryName(topCountry.code, lang)}
                    </span>
                  )}
                </p>
              </motion.div>
            </AnimatePresence>
            {rest > 0 && (
              <span
                className="shrink-0 text-[10px] uppercase tracking-[0.18em]
                           font-display text-white/85 drop-shadow-sm"
                aria-hidden
              >
                +{rest} {t(lang, "highlights_more")}
              </span>
            )}
          </div>
        </div>
      </motion.button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title={t(lang, "highlights_title")}>
        <ul className="flex flex-col gap-2.5">
          {items.map((h) => {
            const avatar = h.avatarId ? getAvatar(h.avatarId) : null;
            const np = (h.meta as { nowPlaying?: string } | null)?.nowPlaying;
            const country = np ? getCountry(np) : null;
            const text = preview(h);
            const isMedia = (h.kind === "gif" || h.kind === "image") && !!h.gifUrl;
            return (
              <li
                key={h.id}
                className="flex flex-col gap-2.5 rounded-2xl glass-surface p-4"
              >
                {/* Country eyebrow — lifted above the quote so the
                    "what was on stage at that moment" context lands
                    before the line itself. Flag + localised name as
                    a small all-caps eyebrow. Falls back to nothing
                    when meta.nowPlaying is empty (bingo strikes
                    sent before the show, etc). */}
                {country && (
                  <p className="text-[10px] uppercase tracking-[0.22em] font-display text-white/55 leading-tight flex items-center gap-1.5">
                    <span aria-hidden>{country.flag}</span>
                    {countryName(country.code, lang)}
                  </p>
                )}

                {/* THE MOMENT — hero-sized type so the quote is the
                    body of the row. GIF / image moments still render
                    the actual asset inline; bingo strikes show the
                    🎯 + bingo label. */}
                {isMedia ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={h.gifUrl!}
                    alt=""
                    className="rounded-xl ring-1 ring-white/10 max-h-64 w-full object-cover"
                  />
                ) : h.kind === "bingo_strike" ? (
                  <p className="font-display text-2xl text-white inline-flex items-center gap-2 leading-snug">
                    <FluentEmoji glyph="🎯" size={24} />
                    {t(lang, "bingo_strike_label")}
                  </p>
                ) : text ? (
                  <p className="font-display text-2xl text-white leading-snug text-balance">
                    {/* Locale-aware quotes — matches the hero card up top. */}
                    {lang === "lt" ? "„" : "“"}
                    {text}
                    {lang === "lt" ? "“" : "”"}
                  </p>
                ) : null}

                {/* Author row — tiny photo matches the reaction pill's
                    h-6 height. Rank badge intentionally NOT shown
                    here — the drawer is already ordered top-to-bottom,
                    so labelling each row with a number was redundant. */}
                <div className="flex items-center gap-2">
                  <span className="h-6 w-6 shrink-0 rounded-md overflow-hidden ring-1 ring-white/12 bg-white/[0.06]">
                    {avatar?.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={optimizedSrc(avatar.photo, 96)}
                        alt=""
                        className="h-full w-full object-cover"
                        style={{ objectPosition: avatar.focal ? `${avatar.focal.x}% ${avatar.focal.y}%` : "50% 30%" }}
                      />
                    ) : (
                      <span className="h-full w-full grid place-items-center text-[9px] font-display text-white/45">
                        {h.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </span>
                  <p className="flex-1 min-w-0 text-xs text-white/85 truncate leading-tight">
                    <span className="font-display text-white/95">{h.name}</span>
                  </p>
                  <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-orange/15 ring-1 ring-orange/35 px-2 h-6 text-xs text-orange tabular-nums font-display">
                    <FluentEmoji glyph="❤️" size={12} />
                    {h.reactionCount}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </BottomSheet>
    </div>
  );
}

