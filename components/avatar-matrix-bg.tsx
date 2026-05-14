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
  // Three DISJOINT samples so no artist repeats across the matrix:
  // stride the photo list by 3 and assign by modulo — row N gets
  // photos[i] where i % 3 === N. Capped at 36 photos so the rows
  // stay visually full without dipping into the long tail of acts.
  const rows = useMemo(() => {
    const photos = AVATARS.filter((a) => a.photo);
    const cap = Math.min(36, photos.length - (photos.length % 3));
    const pool = photos.slice(0, cap);
    return [
      pool.filter((_, i) => i % 3 === 0),
      pool.filter((_, i) => i % 3 === 1),
      pool.filter((_, i) => i % 3 === 2),
    ];
  }, []);

  // Mask: feathered radial vignette PLUS a linear top/bottom fade.
  // Radial alone left the top edge fully visible on short viewports
  // (the matrix container ends up wider than it is tall, so the
  // radial reach in Y doesn't kill the top row). Stacking a vertical
  // linear fade and intersecting the masks gives the matrix a clean
  // soft edge on every side regardless of aspect.
  const mask =
    "linear-gradient(to bottom, transparent 0%, #000 14%, #000 86%, transparent 100%)," +
    " radial-gradient(115% 110% at 50% 50%, #000 18%, rgba(0,0,0,0.55) 55%, transparent 92%)";
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      style={{
        maskImage: mask,
        maskComposite: "intersect",
        WebkitMaskImage: mask,
        WebkitMaskComposite: "source-in",
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
