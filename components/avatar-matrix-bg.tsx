"use client";

import { useMemo } from "react";
import { AVATARS } from "@/lib/avatars";
import { optimizedSrc } from "@/lib/img";

// Diagonal Netflix-style scrolling avatar matrix — drifts behind the
// notification step's bell during onboarding. Three offset rows of
// avatar photos, scrolling at slightly different speeds, masked under
// a strong gradient + blur so the bell stays the focus and the
// matrix reads as ambient depth not foreground content. CSS-only
// animation (keyframe in globals.css) so it's GPU-cheap on mid-end
// Android.
//
// Performance: photos go through next/image's optimizer at w=128
// (the smallest retina size that still reads clean at the 56px tile
// width). 12 tiles × 2 rows × 2 marquee copies = 48 image elements,
// each ~6 KB after WebP — bounded total around 300 KB; cached by the
// optimizer after the first viewer in a room hits each tile.
export function AvatarMatrixBg({ className = "" }: { className?: string }) {
  // Sample 12 avatars deterministically (different stride per row so
  // the rows don't share the same set). Same avatars on every render
  // so the bg doesn't reshuffle on every re-render of step 3.
  const rows = useMemo(() => {
    const photos = AVATARS.filter((a) => a.photo).slice(0, 36);
    const take = (start: number, step: number, n: number) =>
      Array.from({ length: n }, (_, i) => photos[(start + i * step) % photos.length]);
    return [take(0, 1, 12), take(4, 2, 12), take(7, 3, 12)];
  }, []);

  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      <div
        className="absolute inset-0 -rotate-12 origin-center scale-150 flex flex-col gap-3 opacity-25"
      >
        {rows.map((row, rowIdx) => (
          <div
            key={rowIdx}
            className="flex gap-3 w-max"
            style={{
              // Each row drifts at a slightly different speed +
              // direction so the matrix never looks like a flat
              // sliding texture.
              animation: `uzk-marquee ${30 + rowIdx * 8}s linear infinite${
                rowIdx % 2 ? " reverse" : ""
              }`,
              // Stagger the start of each row by a fraction of its
              // cycle so the first paint already shows the rows at
              // different phases.
              animationDelay: `${rowIdx * -7}s`,
            }}
          >
            {[...row, ...row].map((a, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={`${rowIdx}-${i}`}
                src={optimizedSrc(a.photo!, 128)}
                alt=""
                className="h-14 w-14 rounded-xl object-cover ring-1 ring-white/10"
                style={{
                  objectPosition: a.focal
                    ? `${a.focal.x}% ${a.focal.y}%`
                    : "50% 30%",
                }}
                loading="lazy"
              />
            ))}
          </div>
        ))}
      </div>
      {/* Vignette fade so the matrix bleeds off the edges instead of
          ending in a hard line, AND so the centre area where the
          bell + CTAs sit reads with more contrast against the
          backdrop. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 60% at 50% 50%, transparent 0%, oklch(20% 0.08 264 / 0.65) 65%, oklch(15% 0.08 264 / 0.95) 100%)",
        }}
      />
    </div>
  );
}
