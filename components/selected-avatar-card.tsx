"use client";

import { HeartFlag } from "@/components/flag";
import { getAvatar } from "@/lib/avatars";

// The "you picked this artist" card. Shared by the welcome gate and the
// settings avatar sheet so the picked face stays visible while the grid
// scrolls. `sticky` pins it to the bottom of its scroll container with
// a fade above; otherwise it's a plain inline card.
export function SelectedAvatarCard({
  avatarId,
  sticky = false,
}: {
  avatarId: string | null;
  sticky?: boolean;
}) {
  const avatar = getAvatar(avatarId);
  if (!avatar) return null;
  return (
    <div
      className={
        sticky
          ? "sticky bottom-0 z-10 -mx-5 px-5 pt-3 pb-1 bg-gradient-to-t from-dark-blue-900 from-60% via-dark-blue-900/95 to-transparent"
          : ""
      }
    >
      <div className="glass-card rounded-2xl px-4 py-3 flex items-center gap-3">
        <HeartFlag code={avatar.country} size="md" />
        <div className="flex-1 min-w-0">
          <p className="font-display truncate">{avatar.artist}</p>
          <p className="text-xs text-white/55 truncate">
            {avatar.year} · <span className="italic">{avatar.song}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
