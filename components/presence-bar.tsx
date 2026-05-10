"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { motion } from "motion/react";
import { Settings as SettingsIcon } from "lucide-react";
import { useUpdateMyPresence } from "@/lib/liveblocks";
import { getAvatar } from "@/lib/avatars";
import { useRoomLive } from "@/components/room-shell";
import { SettingsModal } from "@/components/settings-modal";

const AVATAR_KEY = "uzk_avatar";

// Header: ESC heart-mark + "Vienna 2026" wordmark on the left, the
// user's avatar tile on the right (tap to open settings). Heart
// beats continuously so the brand reads as alive. No room name, no
// join code — the user is in the room, no point nagging them with
// the URL.
export function PresenceBar() {
  const { code } = useRoomLive();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [avatarId, setAvatarId] = useState<string | null>(null);
  const updatePresence = useUpdateMyPresence();
  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/?room=${code}`
      : "";

  // Subscribe to localStorage so the tile picks up avatar changes made
  // inside the settings drawer without a re-mount.
  useEffect(() => {
    const read = () => setAvatarId(localStorage.getItem(AVATAR_KEY));
    read();
    const onStorage = (e: StorageEvent) => {
      if (e.key === AVATAR_KEY) read();
    };
    const onCustom = () => read();
    window.addEventListener("storage", onStorage);
    window.addEventListener("uzk:avatar-change", onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("uzk:avatar-change", onCustom);
    };
  }, []);

  const avatar = getAvatar(avatarId);

  return (
    <header className="sticky top-0 z-30 backdrop-blur-md bg-dark-blue-900/70 border-b border-white/5">
      <div className="container mx-auto max-w-3xl px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <motion.div
            animate={{ scale: [1, 1.18, 1, 1.1, 1] }}
            transition={{
              duration: 1.1,
              times: [0, 0.18, 0.36, 0.5, 1],
              repeat: Infinity,
              repeatDelay: 0.5,
              ease: "easeInOut",
            }}
            className="origin-center"
          >
            <Image
              src="/images/70-heart-sm.webp"
              alt=""
              width={32}
              height={32}
              priority
              className="h-7 w-7 object-contain"
            />
          </motion.div>
          <p className="text-[11px] uppercase tracking-[0.32em] text-white/70 font-display">
            Vienna 2026
          </p>
        </div>
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          aria-label="Settings"
          className="relative h-10 w-10 rounded-2xl overflow-hidden ring-1 ring-white/15
                     hover:ring-white/35 transition-shadow shadow-[0_4px_12px_-4px_rgba(0,0,0,0.6)]"
        >
          {avatar?.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatar.photo}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              style={{
                objectPosition: avatar.focal
                  ? `${avatar.focal.x}% ${avatar.focal.y}%`
                  : "50% 30%",
              }}
            />
          ) : (
            <span className="absolute inset-0 grid place-items-center bg-flamingo/30 text-white">
              <SettingsIcon className="h-4 w-4" />
            </span>
          )}
        </button>
      </div>

      <SettingsModal
        open={settingsOpen}
        onClose={() => {
          setSettingsOpen(false);
          // Re-read storage on close so the header tile updates instantly.
          setAvatarId(localStorage.getItem(AVATAR_KEY));
          // Mirror into Liveblocks presence so the honeycomb also flips.
          const next = localStorage.getItem(AVATAR_KEY);
          updatePresence({ avatar: next });
        }}
        shareUrl={shareUrl}
      />
    </header>
  );
}
