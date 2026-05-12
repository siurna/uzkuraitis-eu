"use client";

import { useCallback, useEffect, useState } from "react";
import { Flame } from "lucide-react";
import { useEventListener } from "@/lib/liveblocks";
import { useRoomLive } from "@/components/room-shell";
import { getAvatar } from "@/lib/avatars";
import { getCountry, countryName } from "@/lib/countries";
import { optimizedSrc } from "@/lib/img";
import { useLang, t } from "@/lib/i18n";

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

// Home widget: the chat moments that blew up — a little read-only
// gallery. Each row is who said it, the country that was on stage at the
// time, the message (or its GIF), and the reaction tally. No navigation;
// it's a keepsake, not a shortcut. Self-hides if empty.
export function Highlights() {
  const { code } = useRoomLive();
  const lang = useLang();
  const [items, setItems] = useState<Highlight[]>([]);

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

  return (
    <div className="container mx-auto max-w-3xl px-4 flex flex-col gap-3">
      <h2 className="font-display text-xl gradient-text px-1 flex items-center gap-2">
        <Flame className="h-4 w-4 text-orange" fill="currentColor" />
        {t(lang, "highlights_title")}
      </h2>
      <ul className="flex flex-col gap-2">
        {items.map((h) => {
          const avatar = h.avatarId ? getAvatar(h.avatarId) : null;
          const np = (h.meta as { nowPlaying?: string } | null)?.nowPlaying;
          const country = np ? getCountry(np) : null;
          const text =
            h.kind === "bingo_strike" ? "🎯 Bingo!" : (h.body ?? "");
          return (
            <li
              key={h.id}
              className="flex items-center gap-3 rounded-2xl bg-white/[0.04] ring-1 ring-white/8 px-3 py-2.5"
            >
              <span className="h-9 w-9 shrink-0 rounded-xl overflow-hidden ring-1 ring-white/10 bg-white/[0.04]">
                {avatar?.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={optimizedSrc(avatar.photo, 96)}
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
              <span className="shrink-0 flex items-center gap-1 text-xs text-flamingo tabular-nums font-display">
                ❤️ {h.reactionCount}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
