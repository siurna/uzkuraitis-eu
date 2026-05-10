"use client";

import Image from "next/image";
import { motion } from "motion/react";

// Decorative giant 70-year heart pulsing behind the join screen. Sits
// at z-0 (above the page bg, below the form content), with a soft
// blur so the form on top is still legible but the heart is clearly
// visible — not a ghost. Two-beat lub-dub matched to the .heartbeat
// keyframes used elsewhere on the site.
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
        <Image
          src="/images/70-heart.webp"
          alt=""
          fill
          priority
          sizes="80vmin"
          className="object-contain drop-shadow-[0_0_60px_rgba(255,46,222,0.35)]"
        />
      </motion.div>
      {/* Inner glow + outer fade so it bleeds into the page background */}
      <div className="absolute inset-0 bg-radial-fade" />
    </div>
  );
}
