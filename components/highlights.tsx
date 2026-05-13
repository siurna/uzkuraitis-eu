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

// Home widget: the chat moments that blew up. It collapses to a single
// orange banner (top 3 authors' faces + a flame, the hottest line as a
// teaser); tapping opens a drawer with the full read-only gallery. No
// navigation — it's a keepsake, not a shortcut. Self-hides if empty.
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
    const ev = (event as { type?: string }).type;
    if (ev === "chat:react" || ev === "chat:new" || ev === "chat:delete") load();
  });

  if (items.length === 0) return null;

  const preview = (h: Highlight): string =>
    h.kind === "bingo_strike" ? "🎯 Bingo!" : h.body?.trim() || (h.gifUrl ? "GIF" : "");
  const top = items[0];
  const topPreview = preview(top);

  return (
    <div className="container mx-auto max-w-3xl px-4">
      <motion.button
        type="button"
        onClick={() => setOpen(true)}
        initial={{ opacity: 0, y: 12, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 360, damping: 32 }}
        className="relative block w-full overflow-hidden rounded-3xl text-left"
        style={{ background: "linear-gradient(135deg, #ff8a2a 0%, #ef1f3f 52%, #b1146a 100%)" }}
      >
        {/* artwork — the top 3 authors' faces, stacked, + a flame, off the right */}
        <div className="pointer-events-none absolute inset-y-0 -right-1 flex items-center" aria-hidden>
          <span className="flex items-center pr-5 -rotate-6">
            <span className="flex items-center -space-x-3">
              {items.slice(0, 3).map((h) => (
                <AvatarBubble key={h.id} name={h.name} avatarId={h.avatarId} />
              ))}
            </span>
            <span className="ml-1 text-4xl drop-shadow">🔥</span>
          </span>
        </div>
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "linear-gradient(95deg, rgba(8,9,28,0.5) 0%, rgba(8,9,28,0.22) 38%, transparent 64%)" }}
        />
        <div className="relative flex flex-col justify-center gap-1 pl-5 pr-[36%] py-5 min-h-[7rem]">
          <p className="text-[10px] uppercase tracking-[0.3em] font-display leading-tight text-white/80 flex items-center gap-1.5">
            <Flame className="h-3 w-3" fill="currentColor" />
            {t(lang, "highlights_title")}
          </p>
          <p className="font-display text-xl text-white leading-tight drop-shadow-sm">
            {t(lang, "highlights_widget_title")}
          </p>
          <p className="text-sm text-white/75 leading-snug">
            {topPreview ? (
              <span className="block truncate">
                <span className="font-display text-white/90">{top.name}</span>
                {": "}
                {topPreview}
              </span>
            ) : (
              t(lang, "highlights_widget_sub")
            )}
          </p>
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

function AvatarBubble({ name, avatarId }: { name: string; avatarId: string | null }) {
  const avatar = avatarId ? getAvatar(avatarId) : null;
  return (
    <span className="h-11 w-11 shrink-0 rounded-full overflow-hidden ring-2 ring-black/30 bg-dark-blue-800">
      {avatar?.photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={optimizedSrc(avatar.photo, 128)}
          alt=""
          className="h-full w-full object-cover"
          style={{ objectPosition: avatar.focal ? `${avatar.focal.x}% ${avatar.focal.y}%` : "50% 30%" }}
        />
      ) : (
        <span className="h-full w-full grid place-items-center font-display text-sm text-white bg-white/10">
          {name.charAt(0).toUpperCase()}
        </span>
      )}
    </span>
  );
}
