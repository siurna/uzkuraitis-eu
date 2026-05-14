"use client";

import { motion, AnimatePresence } from "motion/react";
import { HeartFlag } from "@/components/flag";
import { getAvatar } from "@/lib/avatars";
import { optimizedSrc } from "@/lib/img";

// The "you picked this artist" card. Shared by the welcome gate and the
// settings avatar sheet — it lives in each sheet's fixed footer so the
// picked face stays visible above the buttons while the grid scrolls.
// Cross-fades when you switch to a different avatar.
//
// `layoutHandoff`: when set, the picked-artist photo is wrapped in a
// `motion.span` carrying `layoutId="uzk-picked-avatar"`. Step 3 of the
// welcome gate renders a tile with the same layoutId inside its
// AvatarMatrixBg, so motion auto-tweens the photo from this footer
// card into the diagonal matrix when the step transitions.
export function SelectedAvatarCard({
  avatarId,
  layoutHandoff = false,
}: {
  avatarId: string | null;
  layoutHandoff?: boolean;
}) {
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
        {layoutHandoff && avatar.photo ? (
          <motion.span
            layoutId="uzk-picked-avatar"
            className="block h-12 w-12 shrink-0 rounded-xl overflow-hidden ring-1 ring-white/15 bg-white/[0.06]"
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={optimizedSrc(avatar.photo, 256)}
              alt=""
              className="h-full w-full object-cover"
              style={{
                objectPosition: avatar.focal
                  ? `${avatar.focal.x}% ${avatar.focal.y}%`
                  : "50% 30%",
              }}
            />
          </motion.span>
        ) : (
          <HeartFlag code={avatar.country} size="md" />
        )}
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
