"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import { Flame } from "lucide-react";
import { useEventListener } from "@/lib/liveblocks";
import { useRoomLive } from "@/components/room-shell";
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

  useEventListener(({ event }) => {
    if (
      event.type === "chat:react" ||
      event.type === "chat:new" ||
      event.type === "chat:delete"
    ) {
      load();
    }
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
    <div className="container mx-auto max-w-3xl px-4 flex flex-col gap-3">
      {/* Section title — same eyebrow language as the other home rails. */}
      <header className="flex items-center justify-between px-1">
        <h2 className="font-display text-base text-white/85 flex items-center gap-2">
          <Flame className="h-4 w-4 text-orange" fill="currentColor" />
          {t(lang, "highlights_title")}
        </h2>
        {rest > 0 && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-[12px] font-display uppercase tracking-[0.18em] text-orange/85
                       hover:text-orange transition px-2 py-1 -mr-2 rounded"
          >
            +{rest} {t(lang, "highlights_more")}
          </button>
        )}
      </header>

      {/* Trophy card — full-width, skeuomorphic glass over a warm wash,
          the single hottest moment dressed up like something you'd
          re-share. Tap anywhere to open the full gallery. */}
      <motion.button
        type="button"
        onClick={() => setOpen(true)}
        initial={{ opacity: 0, y: 12, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 360, damping: 32 }}
        className="relative block w-full overflow-hidden rounded-3xl text-left
                   shadow-[0_18px_44px_-18px_oklch(58%_0.18_42_/_0.55),inset_0_1px_0_rgba(255,255,255,0.18)]
                   ring-1 ring-white/8"
        style={{ background: "linear-gradient(135deg, #ff8a2a 0%, #ef1f3f 52%, #b1146a 100%)" }}
      >
        {/* Soft top-light strip (the skeuo gloss) */}
        <span
          className="pointer-events-none absolute inset-x-0 top-0 h-1/2"
          style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.20) 0%, transparent 70%)" }}
          aria-hidden
        />
        <div className="relative flex flex-col gap-3 p-5">
          {/* Author row */}
          <div className="flex items-center gap-3">
            <span className="h-11 w-11 shrink-0 rounded-2xl overflow-hidden ring-2 ring-white/30 bg-dark-blue-800">
              {topAvatar?.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={optimizedSrc(topAvatar.photo, 128)}
                  alt=""
                  className="h-full w-full object-cover"
                  style={{ objectPosition: topAvatar.focal ? `${topAvatar.focal.x}% ${topAvatar.focal.y}%` : "50% 30%" }}
                />
              ) : (
                <span className="h-full w-full grid place-items-center font-display text-base text-white bg-white/15">
                  {top.name.charAt(0).toUpperCase()}
                </span>
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-base text-white leading-tight truncate drop-shadow-sm">
                {top.name}
              </p>
              {topCountry && (
                <p className="text-[11px] text-white/80 leading-tight truncate">
                  {topCountry.flag} {countryName(topCountry.code, lang)}
                </p>
              )}
            </div>
            <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-white/20 ring-1 ring-white/30 px-2.5 h-7 text-sm text-white tabular-nums font-display">
              ❤️ {top.reactionCount}
            </span>
          </div>
          {/* The quote itself */}
          {topPreview && (
            <p className="font-display text-lg text-white leading-snug text-balance drop-shadow-sm line-clamp-3">
              “{topPreview}”
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
        </div>
      </motion.button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title={t(lang, "highlights_title")}>
        <ul className="flex flex-col gap-2">
          {items.map((h) => {
            const avatar = h.avatarId ? getAvatar(h.avatarId) : null;
            const np = (h.meta as { nowPlaying?: string } | null)?.nowPlaying;
            const country = np ? getCountry(np) : null;
            const text = preview(h);
            return (
              <li
                key={h.id}
                className="flex items-center gap-3 rounded-2xl bg-orange/[0.07] ring-1 ring-orange/20 px-3 py-2.5 shadow-[0_2px_18px_-6px_oklch(70%_0.19_42_/_0.35)]"
              >
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
                  <p className="text-[11px] text-white/55 leading-tight flex items-center gap-1.5 truncate">
                    <span className="font-display text-white/80">{h.name}</span>
                    {country && (
                      <>
                        <span className="text-white/25">·</span>
                        <span className="truncate">{country.flag} {countryName(country.code, lang)}</span>
                      </>
                    )}
                  </p>
                  {text && <p className="text-sm text-white/90 leading-snug truncate">{text}</p>}
                </div>
                {h.gifUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={h.gifUrl}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-lg object-cover ring-1 ring-white/10"
                  />
                )}
                <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-orange/15 ring-1 ring-orange/35 px-2 h-6 text-xs text-orange tabular-nums font-display">
                  ❤️ {h.reactionCount}
                </span>
              </li>
            );
          })}
        </ul>
      </BottomSheet>
    </div>
  );
}

