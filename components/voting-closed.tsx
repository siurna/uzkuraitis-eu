"use client";

import { motion } from "motion/react";
import { Lock } from "lucide-react";
import { useRoomLive } from "@/components/room-shell";
import { t } from "@/lib/i18n";
import { useLang } from "@/lib/i18n-client";

// Shown in the Vote tab when the host hasn't opened (or has closed)
// voting. A padlock + a line — and a second line that reads the show
// state: before the night's over, "let's enjoy the show first"; once
// performances have ended, "waiting for the official results". `flex-1`
// centres it in the room layout's remaining space.
export function VotingClosed() {
  const lang = useLang();
  const { showStatus } = useRoomLive();
  const sub =
    showStatus === "ended"
      ? t(lang, "voting_closed_results")
      : t(lang, "voting_closed_show");
  return (
    <main className="flex-1 flex items-center justify-center px-8 text-center">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col items-center gap-4"
      >
        <span className="grid place-items-center h-16 w-16 uzk-icon-squircle
                         bg-white/[0.06] ring-1 ring-white/12">
          <Lock className="h-7 w-7 text-dark-blue-200" />
        </span>
        <div className="flex flex-col items-center gap-1.5">
          <p className="font-display text-2xl gradient-text text-balance">{t(lang, "voting_closed")}</p>
          <p className="text-sm text-white/55 leading-snug max-w-[20rem] text-balance">{sub}</p>
        </div>
      </motion.div>
    </main>
  );
}
