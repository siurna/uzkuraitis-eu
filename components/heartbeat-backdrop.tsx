"use client";

import Image from "next/image";
import { motion } from "motion/react";

// Decorative giant 70-year heart pulsing in the background. Sits below the
// content (z-0), with a heavy blur and low opacity so it never fights the
// foreground card. Animates a real heartbeat curve (two beats + rest).
export function HeartbeatBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 flex items-center justify-center overflow-hidden"
    >
      <motion.div
        initial={{ scale: 1, opacity: 0.55 }}
        animate={{
          scale: [1, 1.07, 1, 1.05, 1],
          opacity: [0.45, 0.6, 0.45, 0.55, 0.45],
        }}
        transition={{
          duration: 1.2,
          times: [0, 0.18, 0.36, 0.5, 1],
          repeat: Infinity,
          repeatDelay: 0.4,
          ease: "easeInOut",
        }}
        className="relative aspect-square w-[120vmin]"
        style={{ filter: "blur(6px) saturate(1.1)" }}
      >
        <Image
          src="/images/70-heart@2x.webp"
          alt=""
          fill
          priority
          sizes="120vmin"
          className="object-contain"
        />
      </motion.div>
      {/* Inner glow + outer fade so it bleeds into the page background */}
      <div className="absolute inset-0 bg-radial-fade" />
    </div>
  );
}
