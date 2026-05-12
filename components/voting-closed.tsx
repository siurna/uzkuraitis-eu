"use client";

import { motion } from "motion/react";
import { Lock } from "lucide-react";
import { useRoomLive } from "@/components/room-shell";
import { useLang, t } from "@/lib/i18n";

// Shown in the Vote tab when the host hasn't opened (or has closed)
// voting. Just a padlock + one line — no card, no scroll. `flex-1`
// centres it in the room layout's remaining space.
export function VotingClosed() {
  const lang = useLang();
  const { showStatus } = useRoomLive();
  const sub =
    showStatus === "ended" ? t(lang, "voting_closed_ended_sub") : t(lang, "voting_closed_sub");

  return (
    <main className="flex-1 flex items-center justify-center px-8 text-center">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col items-center gap-4 max-w-xs"
      >
        <span className="grid place-items-center h-16 w-16 rounded-2xl
                         bg-white/[0.06] ring-1 ring-white/12">
          <Lock className="h-7 w-7 text-white/55" />
        </span>
        <p className="font-display text-2xl gradient-text">{t(lang, "voting_closed")}</p>
        <p className="text-sm text-white/55 leading-relaxed">{sub}</p>
      </motion.div>
    </main>
  );
}
