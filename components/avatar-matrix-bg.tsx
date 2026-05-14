"use client";

import { useMemo } from "react";
import { AVATARS } from "@/lib/avatars";
import { optimizedSrc } from "@/lib/img";

// Three rows of past-act press-kit photos drifting diagonally behind
// the notification-step bell. No tinted overlay (Apple "now playing"
// dynamic-island vibe — the photos read clear in the middle and just
// blur out at the edges via a feathered mask). Container fills the
// step body so the bell sits centred over a fully populated matrix
// instead of a thin top strip.
export function AvatarMatrixBg({ className = "" }: { className?: string }) {
  // Three distinct samples so neighbouring rows don't repeat the
  // same face. Stable across re-renders.
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
      style={{
        // Feathered mask: photos sharp through the middle 60% of
        // every axis, fading to fully transparent at the edges. No
        // tinted overlay over the top — the bell + copy stay
        // readable because the mask kills the matrix exactly where
        // they sit, not because we tint everything.
        maskImage:
          "radial-gradient(115% 110% at 50% 50%, #000 18%, rgba(0,0,0,0.55) 55%, transparent 92%)",
        WebkitMaskImage:
          "radial-gradient(115% 110% at 50% 50%, #000 18%, rgba(0,0,0,0.55) 55%, transparent 92%)",
      }}
    >
      <div className="absolute inset-0 -rotate-12 origin-center scale-150 flex flex-col justify-center gap-3 opacity-40">
        {rows.map((row, rowIdx) => (
          <div
            key={rowIdx}
            className="flex gap-3 w-max"
            style={{
              // Each row drifts at a slightly different speed +
              // direction so the matrix never reads as one flat
              // sliding texture.
              animation: `uzk-marquee ${30 + rowIdx * 8}s linear infinite${
                rowIdx % 2 ? " reverse" : ""
              }`,
              animationDelay: `${rowIdx * -7}s`,
            }}
          >
            {[...row, ...row].map((a, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={`${rowIdx}-${i}`}
                src={optimizedSrc(a.photo!, 128)}
                alt=""
                className="h-16 w-16 rounded-xl object-cover ring-1 ring-white/10"
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
    </div>
  );
}
