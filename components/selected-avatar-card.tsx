"use client";

import { motion, AnimatePresence } from "motion/react";
import { HeartFlag } from "@/components/flag";
import { getAvatar } from "@/lib/avatars";

// The "you picked this artist" card. Shared by the welcome gate and the
// settings avatar sheet — it lives in each sheet's fixed footer so the
// picked face stays visible above the buttons while the grid scrolls.
// Cross-fades when you switch to a different avatar.
export function SelectedAvatarCard({ avatarId }: { avatarId: string | null }) {
  const avatar = getAvatar(avatarId);
  if (!avatar) return null;
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={avatar.id}
        initial={{ opacity: 0, y: 8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.98 }}
        transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
        className="glass-card rounded-2xl px-4 py-3 flex items-center gap-3"
      >
        <HeartFlag code={avatar.country} size="md" />
        <div className="flex-1 min-w-0">
          <p className="font-display truncate">{avatar.artist}</p>
          <p className="text-xs text-white/55 truncate">
            {avatar.year} · <span className="italic">{avatar.song}</span>
          </p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
