"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { useEventListener } from "@/lib/liveblocks";
import { getCountry, countryName } from "@/lib/countries";
import { countryColors } from "@/lib/country-colors";
import { Flag } from "@/components/flag";
import { useLang, t } from "@/lib/i18n";

// The orchestrated "X is on stage" takeover. Fires on every
// now-playing:change carrying a country code: a full-screen wash in
// that flag's colours + the country name huge in the display
// (Singing Sans) face with an animated gradient sweep, then the
// artist · song line. ~5s, fades out. The heart swarm in RoomShell
// runs underneath at the same time.
//
// Portaled to <body>, pointer-events-none, z below the voting
// takeover (which is a higher-priority interruption).

const HOLD_MS = 5200;

export function NowPlayingTakeover() {
  const lang = useLang();
  const [active, setActive] = useState<{ id: number; code: string } | null>(
    null,
  );
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEventListener(({ event }) => {
    if ((event as { type?: string }).type !== "now-playing:change") return;
    const next = (event as { countryCode: string | null }).countryCode;
    if (!next) {
      // Cleared — drop any showing takeover.
      if (timer.current) clearTimeout(timer.current);
      setActive(null);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    setActive({ id: Date.now(), code: next });
    timer.current = setTimeout(() => setActive(null), HOLD_MS);
  });

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  if (typeof document === "undefined") return null;
  const country = active ? getCountry(active.code) : null;
  const [c1, c2] = country ? countryColors(country.code) : ["#ff2ede", "#4cc9f0"];
  const name = country ? countryName(country.code, lang) : "";
  // Auto-fit the name to the viewport width: roughly width / (chars ×
  // glyph-width) — the display face is condensed so ~0.55em per char.
  // Clamped so short names don't get cartoonishly huge or long ones
  // (e.g. "Jungtinė Karalystė") shrink to nothing.
  const longestWord = name.split(/\s+/).reduce((a, w) => Math.max(a, w.length), 1);
  const nameVw = Math.max(7, Math.min(30, (94 / Math.max(longestWord, 5)) * 1.7));

  return createPortal(
    <AnimatePresence>
      {country && active && (
        <motion.div
          key={active.id}
          className="fixed inset-0 z-[88] flex flex-col items-center justify-center px-6 text-center pointer-events-none overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Colour wash — two radial pools in the flag colours that
              slowly breathe. Sits over the page but under the text. */}
          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.85, 0.7, 0.78, 0] }}
            transition={{ duration: HOLD_MS / 1000, times: [0, 0.12, 0.5, 0.8, 1] }}
            style={{
              background: `radial-gradient(70% 60% at 20% 25%, ${hexA(c1, 0.72)}, transparent 70%), radial-gradient(70% 60% at 85% 80%, ${hexA(c2, 0.6)}, transparent 70%), rgba(5,6,20,0.55)`,
            }}
          />
          {/* Faint shimmer band sweeping across, tinted with c1. */}
          <motion.div
            className="absolute inset-x-0 top-1/3 h-1/3 blur-3xl"
            style={{
              background: `linear-gradient(90deg, transparent, ${hexA(c1, 0.55)}, ${hexA(c2, 0.45)}, transparent)`,
              backgroundSize: "250% 100%",
            }}
            initial={{ backgroundPositionX: "0%", opacity: 0 }}
            animate={{ backgroundPositionX: ["0%", "250%"], opacity: [0, 0.6, 0] }}
            transition={{ duration: 3.4, ease: "easeInOut", times: [0, 0.5, 1] }}
          />

          {/* Big heart-flag drifting up above the name. */}
          <motion.div
            initial={{ opacity: 0, y: 70, scale: 0.5 }}
            animate={{ opacity: [0, 1, 1, 0], y: [70, 0, -10, -34], scale: [0.5, 1, 1, 0.92] }}
            transition={{ duration: HOLD_MS / 1000, times: [0, 0.16, 0.85, 1], ease: [0.22, 1, 0.36, 1] }}
            className="relative mb-5 heartbeat drop-shadow-[0_12px_44px_rgba(0,0,0,0.5)]"
          >
            <Flag
              code={country.code}
              size="xl"
              className="h-36 w-36 sm:h-52 sm:w-52"
            />
          </motion.div>

          {/* The country name — auto-sized to fit, display face, animated
              gradient sweep through the flag colours + white. Rises from
              below. */}
          <motion.h1
            initial={{ opacity: 0, y: 90, scale: 0.85 }}
            animate={{
              opacity: [0, 1, 1, 0],
              y: [90, 0, 0, -24],
              scale: [0.85, 1, 1, 1.04],
            }}
            transition={{
              duration: HOLD_MS / 1000,
              times: [0, 0.18, 0.85, 1],
              ease: [0.18, 0.9, 0.25, 1],
            }}
            className="relative font-display uppercase leading-[0.92] tracking-tight
                       max-w-[94vw] text-balance drop-shadow-[0_8px_40px_rgba(0,0,0,0.45)]"
            style={{
              fontSize: `clamp(2rem, ${nameVw}vw, 11rem)`,
              backgroundImage: `linear-gradient(100deg, #ffffff, ${c1}, ${c2}, #ffffff, ${c1})`,
              backgroundSize: "260% 100%",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            <motion.span
              className="inline-block"
              animate={{ backgroundPositionX: ["0%", "260%"] }}
              transition={{ duration: 2.6, ease: "linear", repeat: Infinity }}
              style={{
                backgroundImage: "inherit",
                backgroundSize: "inherit",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              {name}
            </motion.span>
          </motion.h1>

          {/* On-stage label, then artist and song on their own lines. */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: [0, 1, 1, 0], y: [20, 0, 0, -10] }}
            transition={{ duration: HOLD_MS / 1000, times: [0, 0.26, 0.85, 1] }}
            className="relative mt-4 flex flex-col items-center gap-1.5"
          >
            <span className="text-[11px] sm:text-xs uppercase tracking-[0.42em] text-white/65 font-display">
              {t(lang, "now_playing")}
            </span>
            {country.artist && (
              <span className="text-2xl sm:text-3xl text-white font-display leading-tight text-balance">
                {country.artist}
              </span>
            )}
            {country.song && (
              <span className="text-base sm:text-xl text-white/55 italic leading-tight text-balance">
                {country.song}
              </span>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

// "#rrggbb" + alpha 0..1 → "rgba(r,g,b,a)". Falls back to the input
// untouched if it's not a 6-digit hex.
function hexA(hex: string, a: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
