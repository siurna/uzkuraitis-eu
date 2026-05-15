"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
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

  if (items.length === 0) return null;

  const preview = (h: Highlight): string =>
    h.kind === "bingo_strike" ? "🎯 Bingo!" : h.body?.trim() || (h.gifUrl ? "GIF" : "");
  const top = items[0];
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
        <div className="relative flex flex-col gap-3 p-5">
          {/* Top row — eyebrow + reaction count badge on the same
              baseline. Icon switched to solid-tinted dark-amber so it
              reads against the orange-pink wash instead of bleeding
              into it. */}
          <div className="flex items-center gap-2">
            <p className="text-[10px] uppercase tracking-[0.3em] text-white/95 font-display leading-tight flex items-center gap-1.5">
              <Flame
                className="h-3 w-3"
                fill="#3a1505"
                style={{ color: "#3a1505" }}
              />
              {t(lang, "highlights_title")}
            </p>
            <span
              className="ml-auto shrink-0 inline-flex items-center gap-1 rounded-full
                         bg-white/25 ring-1 ring-white/40 px-2.5 h-6
                         text-xs text-white tabular-nums font-display"
            >
              <FluentEmoji glyph="❤️" size={12} />
              {top.reactionCount}
            </span>
          </div>

          {/* The quote, now hero-sized in the slot that used to hold
              the author. */}
          {topPreview && (
            <p className="font-display text-2xl text-white leading-snug text-balance drop-shadow-sm line-clamp-3 pr-20">
              {/* Locale-aware quotes: Lithuanian uses „low-9 + left
                  open“ (U+201E + U+201C), English uses the curly
                  pair “…” (U+201C + U+201D). The card's text body is
                  the user's own quote, but the punctuation around
                  it should follow the reader's language. */}
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

          {/* Author row, now small, in the slot the quote used to
              live in. Avatar + name + country chip read as a caption
              under the headline quote. */}
          {/* Author row + "+N daugiau" share the same baseline so the
              eye reads "this person said it, and there are N more
              like this" as one unit. The +N pinned right keeps the
              card's bottom edge visually balanced. */}
          <div className="flex items-center gap-2">
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
        <ul className="flex flex-col gap-2">
          {items.map((h) => {
            const avatar = h.avatarId ? getAvatar(h.avatarId) : null;
            const np = (h.meta as { nowPlaying?: string } | null)?.nowPlaying;
            const country = np ? getCountry(np) : null;
            const text = preview(h);
            const isMedia = (h.kind === "gif" || h.kind === "image") && !!h.gifUrl;
            return (
              <li
                key={h.id}
                className="flex flex-col gap-2 rounded-2xl glass-surface p-3"
              >
                {/* Header row: avatar + name + country chip + heart count.
                    Reads as a chat-card header so the drawer feels like
                    a screenshot of the moment, not a stats list. */}
                <div className="flex items-center gap-3">
                  <span className="h-9 w-9 shrink-0 rounded-xl overflow-hidden ring-1 ring-white/12 bg-white/[0.06]">
                    {avatar?.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={optimizedSrc(avatar.photo, 128)}
                        alt=""
                        className="h-full w-full object-cover"
                        style={{ objectPosition: avatar.focal ? `${avatar.focal.x}% ${avatar.focal.y}%` : "50% 30%" }}
                      />
                    ) : (
                      <span className="h-full w-full grid place-items-center text-xs font-display text-white/45">
                        {h.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-sm text-white/90 truncate leading-tight">
                      {h.name}
                    </p>
                    {country && (
                      <p className="text-[11px] text-white/55 leading-tight truncate">
                        {country.flag} {countryName(country.code, lang)}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-orange/15 ring-1 ring-orange/35 px-2 h-6 text-xs text-orange tabular-nums font-display">
                    <FluentEmoji glyph="❤️" size={12} />
                    {h.reactionCount}
                  </span>
                </div>

                {/* Body — quote or media. For GIF/image the picture IS
                    the moment, so render it inline instead of an italic
                    "GIF" placeholder. */}
                {isMedia ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={h.gifUrl!}
                    alt=""
                    className="rounded-xl ring-1 ring-white/10 max-h-44 w-auto self-start"
                  />
                ) : h.kind === "bingo_strike" ? (
                  <p className="text-sm text-white/85 inline-flex items-center gap-1.5">
                    <FluentEmoji glyph="🎯" size={16} />
                    Bingo!
                  </p>
                ) : text ? (
                  <p className="text-[15px] text-white leading-snug text-balance pl-12">
                    {text}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      </BottomSheet>
    </div>
  );
}

