"use client";

import { useMemo } from "react";
import { motion } from "motion/react";
import { AVATARS, getAvatar } from "@/lib/avatars";
import { optimizedSrc } from "@/lib/img";

// Three rows of past-act press-kit photos drifting diagonally behind
// the notification-step bell. No tinted overlay (Apple "now playing"
// dynamic-island vibe — the photos read clear in the middle and just
// blur out at the edges via a feathered mask). Container fills the
// step body so the bell sits centred over a fully populated matrix
// instead of a thin top strip.
//
// `pickedAvatarId`: when the welcome gate hands off from step 2 → 3,
// the picked avatar's photo flies from the SelectedAvatarCard's
// `layoutId="uzk-picked-avatar"` motion span into one of the matrix
// tiles. We earmark a slot near the visual centre of row 0 so the
// face lands somewhere the user actually sees, then carry the same
// layoutId on it. motion handles the cross-tree shared-element
// animation. If the picked avatar has no photo, the matrix renders
// the default tile in that slot — no fallback to draw.
export function AvatarMatrixBg({
  className = "",
  pickedAvatarId = null,
}: {
  className?: string;
  pickedAvatarId?: string | null;
}) {
  // Three DISJOINT samples so no artist repeats across the matrix:
  // stride the photo list by 3 and assign by modulo — row N gets
  // photos[i] where i % 3 === N. Capped at 36 photos so the rows
  // stay visually full without dipping into the long tail of acts.
  // When `pickedAvatarId` is set we splice the picked face into a
  // designated slot of the first row so motion's layoutId animation
  // has a clear target. Earlier appearance of the same picked photo
  // in the pool (the picked avatar might already be sampled) is
  // filtered out first so it isn't repeated.
  const PICKED_SLOT_ROW = 0;
  const PICKED_SLOT_INDEX = 4;
  const rows = useMemo(() => {
    const picked = pickedAvatarId ? getAvatar(pickedAvatarId) : null;
    const usable = AVATARS.filter(
      (a) => a.photo && (!picked || a.id !== picked.id),
    );
    const cap = Math.min(36, usable.length - (usable.length % 3));
    const pool = usable.slice(0, cap);
    const out = [
      pool.filter((_, i) => i % 3 === 0),
      pool.filter((_, i) => i % 3 === 1),
      pool.filter((_, i) => i % 3 === 2),
    ];
    if (picked?.photo) {
      const row = out[PICKED_SLOT_ROW];
      if (row.length > PICKED_SLOT_INDEX) row[PICKED_SLOT_INDEX] = picked;
    }
    return out;
  }, [pickedAvatarId]);

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
            {[...row, ...row].map((a, i) => {
              // First instance of the picked slot in row 0 carries
              // the shared `layoutId` so it animates in from the
              // SelectedAvatarCard's photo bubble on step 2 → 3.
              // The duplicate (i = row.length + PICKED_SLOT_INDEX) is
              // a plain `<img>` so we don't double-register the
              // layoutId — only one node ever owns the shared element.
              const isHandoffSlot =
                rowIdx === PICKED_SLOT_ROW &&
                i === PICKED_SLOT_INDEX &&
                pickedAvatarId === a.id;
              if (isHandoffSlot) {
                return (
                  <motion.span
                    key={`${rowIdx}-${i}`}
                    layoutId="uzk-picked-avatar"
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    className="block h-16 w-16 shrink-0 rounded-xl overflow-hidden ring-1 ring-white/10"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={optimizedSrc(a.photo!, 128)}
                      alt=""
                      className="h-full w-full object-cover"
                      style={{
                        objectPosition: a.focal
                          ? `${a.focal.x}% ${a.focal.y}%`
                          : "50% 30%",
                      }}
                    />
                  </motion.span>
                );
              }
              return (
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
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
