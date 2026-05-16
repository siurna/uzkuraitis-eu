"use client";

import { motion } from "motion/react";

// Decorative giant 70-year heart pulsing behind the join screen. Sits
// at z-0 (above the page bg, below the form content), with a soft
// blur so the form on top is still legible but the heart is clearly
// visible, not a ghost. Two-beat lub-dub matched to the .heartbeat
// keyframes used elsewhere on the site.
//
// Plain <img> instead of next/image: the wrapper span next/image
// injects on iOS Safari causes `filter: drop-shadow` to render
// against the bounding box for the first paint frame (transparent
// square halo around the heart). Plain <img> avoids that AND keeps
// the asset-priority hint via fetchpriority.
export function HeartbeatBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 flex items-center justify-center overflow-hidden"
    >
      <motion.div
        initial={{ scale: 1, opacity: 0.5 }}
        animate={{
          scale: [1, 1.18, 0.98, 1.12, 1, 1.16, 0.99, 1.08, 1],
          opacity: [0.45, 0.6, 0.45, 0.55, 0.45, 0.58, 0.45, 0.5, 0.45],
        }}
        transition={{
          duration: 1.4,
          times: [0, 0.1, 0.22, 0.32, 0.44, 0.56, 0.68, 0.78, 1],
          repeat: Infinity,
          repeatDelay: 0.6,
          ease: [0.45, 0, 0.55, 1],
        }}
        className="relative aspect-square w-[80vmin] sm:w-[70vmin]"
        style={{ filter: "blur(2px) saturate(1.05)" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/70-heart.webp"
          alt=""
          fetchPriority="high"
          className="absolute inset-0 h-full w-full object-contain drop-shadow-[0_0_60px_rgba(255,46,222,0.35)]"
        />
      </motion.div>
      {/* (Earlier: an `absolute inset-0 bg-radial-fade` vignette behind
          the heart that filled the entire viewport with a dark-blue-900
          ring. It was covering html::before's bloom near the bottom of
          the page on short layouts — the visible area read as a flat
          dark band beneath the heart instead of the brand violet. The
          heart's own drop-shadow already does the focus-pull job, so
          the vignette was net-cost.) */}
    </div>
  );
}
