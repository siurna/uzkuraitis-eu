"use client";

import Image from "next/image";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";
import { useLang } from "@/lib/i18n-client";

// Official Eurovision 2026 70-year wordmark + UBM ribbon, scraped from
// eurovision.com/static/images/. The whole stack fades in on mount with a
// staggered reveal so the gate doesn't pop into existence.
export function Logo2026({ className }: { className?: string }) {
  const lang = useLang();
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: 0.18, delayChildren: 0.05 } },
      }}
      className={cn(
        "flex flex-col items-center text-center select-none gap-3",
        className,
      )}
    >
      <motion.div
        variants={{
          hidden: { opacity: 0, y: 12, scale: 0.92 },
          visible: { opacity: 1, y: 0, scale: 1 },
        }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Native aspect of /images/70-logo@2x.webp is 1162×806
            (≈1.44:1). The previous declaration (420×140 ≈ 3:1)
            squashed the heart. Pass the real natural dims and let
            CSS handle the responsive width. The whole mark gets a
            real heartbeat (two-beat lub-dub) so the brand actually
            pulses instead of sitting flat. */}
        <motion.div
          animate={{ scale: [1, 1.06, 1, 1.04, 1] }}
          transition={{
            duration: 1.1,
            times: [0, 0.18, 0.36, 0.5, 1],
            repeat: Infinity,
            repeatDelay: 0.6,
            ease: "easeInOut",
          }}
          className="origin-bottom"
        >
          <Image
            src="/images/70-logo@2x.webp"
            alt="Eurovision Song Contest"
            width={1162}
            height={806}
            priority
            sizes="(min-width: 640px) 280px, 240px"
            className="w-full max-w-[280px] h-auto object-contain drop-shadow-[0_0_24px_rgba(124,224,216,0.25)]"
          />
        </motion.div>
      </motion.div>
      <motion.div
        variants={{
          hidden: { opacity: 0, y: 8 },
          visible: { opacity: 0.85, y: 0 },
        }}
        transition={{ duration: 0.6 }}
      >
        <Image
          src="/images/ubm.svg"
          alt="United by music"
          width={120}
          height={32}
        />
      </motion.div>
      <motion.p
        variants={{
          hidden: { opacity: 0 },
          visible: { opacity: 0.5 },
        }}
        transition={{ duration: 0.6 }}
        className="text-xs uppercase tracking-[0.4em] text-white font-display"
      >
        {t(lang, "host_city_year")}
      </motion.p>
    </motion.div>
  );
}
