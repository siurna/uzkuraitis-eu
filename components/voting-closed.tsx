"use client";

import { motion } from "motion/react";
import { useRoomLive } from "@/components/room-shell";
import { useLang, t } from "@/lib/i18n";

// "Voting is closed" placeholder shown in the Vote tab when the host
// has paused voting. flex-1, centred — fills the room layout's
// remaining space without making the page scrollable. Reflects the
// show status so the copy isn't always the same.
export function VotingClosed({ code }: { code: string }) {
  const lang = useLang();
  // showStatus lives in the room live context — refreshed on
  // room:updated so this card stays current as the host flips state.
  const { showStatus } = useRoomLive();

  const headline =
    showStatus === "in_progress"
      ? t(lang, "voting_closed_live")
      : showStatus === "ended"
        ? t(lang, "voting_closed_ended")
        : t(lang, "voting_closed");
  const sub =
    showStatus === "ended"
      ? t(lang, "voting_closed_ended_sub")
      : t(lang, "voting_closed_sub");

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-10 text-center">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        className="glass-card rounded-2xl px-6 py-8 max-w-sm flex flex-col items-center gap-3"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/70-heart.webp"
          alt=""
          className="h-16 w-16 object-contain opacity-80"
        />
        <p className="font-display text-2xl gradient-text">{headline}</p>
        <p className="text-white/60 text-sm leading-relaxed">{sub}</p>
        <span hidden data-code={code} />
      </motion.div>
    </main>
  );
}
