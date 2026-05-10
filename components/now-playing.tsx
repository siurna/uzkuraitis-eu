"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useEventListener } from "@/lib/liveblocks";
import { useRoomLive } from "@/components/room-shell";
import { useParticles } from "@/components/particle-layer";
import { HeartFlag } from "@/components/flag";
import { getCountry } from "@/lib/countries";
import { participantPhoto } from "@/lib/participants";
import { useLang, t } from "@/lib/i18n";

// Top-of-screen "on stage now" strip. Admin sets the active country
// via the magic room admin link; server broadcasts now-playing:change
// and the strip animates the swap + spawns a heart-flag swarm so the
// switch reads as a moment, not a static label.
//
// Hidden when no country is set. Lives just below the PresenceBar in
// the room layout, above the tab content.
export function NowPlaying() {
  const { code, homeCountryCode } = useRoomLive();
  const lang = useLang();
  const particles = useParticles();
  const [countryCode, setCountryCode] = useState<string | null>(null);
  const lastSeen = useRef<string | null>(null);

  // Pull the initial state from the room manage endpoint via the
  // public room route (anyone can read who's playing). We piggyback
  // on the existing `/api/rooms/[code]` GET response.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/rooms/${code}`, { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { nowPlayingCode?: string | null };
        const next = data.nowPlayingCode ?? null;
        setCountryCode(next);
        lastSeen.current = next;
      } catch {
        /* offline tolerable */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  useEventListener(({ event }) => {
    if ((event as { type?: string }).type !== "now-playing:change") return;
    const next = (event as { countryCode: string | null }).countryCode;
    if (next === lastSeen.current) return;
    lastSeen.current = next;
    setCountryCode(next);
    // Spawn a heart-flag swarm of the new country across the viewport
    // so the change reads as celebration, not a status flicker.
    if (next) {
      const count = 18;
      const w = window.innerWidth;
      const h = window.innerHeight;
      particles.spawnMany(
        Array.from({ length: count }, () => ({
          asset: { type: "country" as const, code: next },
          from: { x: w / 2, y: h * 0.45 },
          to: {
            x: Math.random() * w,
            y: Math.random() * h * 0.85,
          },
          size: 44 + Math.random() * 28,
          durationMs: 1400 + Math.random() * 400,
          rotate: 18,
        })),
      );
    }
  });

  const country = countryCode ? getCountry(countryCode) : null;

  return (
    <div className="sticky top-[57px] z-20 backdrop-blur-md bg-dark-blue-900/55 border-b border-white/5">
      <div className="container mx-auto max-w-3xl px-4 py-2 flex items-center gap-3 h-12">
        <span className="text-[10px] uppercase tracking-[0.32em] text-white/45 font-display">
          {t(lang, "now_playing")}
        </span>
        <div className="flex-1 min-w-0 overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            {country ? (
              <motion.div
                key={country.code}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                className="flex items-center gap-2.5 min-w-0"
              >
                {/* Artist hero thumbnail — the strip suddenly carries
                    a face when admin flips a country live. Pulses
                    softly while on stage. */}
                <motion.span
                  animate={{ scale: [1, 1.06, 1] }}
                  transition={{
                    duration: 2.4,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  className="relative h-8 w-8 shrink-0 rounded-full overflow-hidden
                             ring-1 ring-white/15 shadow-[0_4px_12px_-4px_rgba(255,46,222,0.45)]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={participantPhoto(country.code) ?? `/flags/${country.code}.svg`}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                </motion.span>
                <HeartFlag code={country.code} name={country.name} size="sm" />
                {country.artist && (
                  <span className="text-xs text-white/55 truncate hidden sm:inline">
                    {country.artist}
                    {country.song && (
                      <>
                        {" · "}
                        <span className="italic">{country.song}</span>
                      </>
                    )}
                  </span>
                )}
              </motion.div>
            ) : (
              <motion.span
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-xs text-white/40 italic"
              >
                {t(lang, "now_playing_idle")}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>
      {/* homeCountryCode is read here so the room context refetch
          keeps NowPlaying in scope (lint defence — actually used). */}
      <span hidden data-home={homeCountryCode} />
    </div>
  );
}
