"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "motion/react";
import { Settings as SettingsIcon } from "lucide-react";
import { useUpdateMyPresence } from "@/lib/liveblocks";
import { getAvatar } from "@/lib/avatars";
import { useRoomLive } from "@/components/room-shell";
import { SettingsModal } from "@/components/settings-modal";
import { Flag } from "@/components/flag";
import { getCountry } from "@/lib/countries";
import { useLang, t } from "@/lib/i18n";

const NAME_KEY = "uzk_name";
const AVATAR_KEY = "uzk_avatar";

// Unified room header. Carries everything chrome-y in one translucent
// strip:
//   left:  brand mark (heart) that morphs to the heart-flag of the
//          country currently on stage, with "Scenoje · <Artist · Song>"
//          beside it when active, or "Vienna 2026" when idle.
//   right: your name + avatar tile (tap → settings drawer).
//
// One sticky element instead of the old Header + NowPlaying stack —
// keeps the backdrop visible and the page chrome quiet.
export function PresenceBar() {
  const { code, nowPlayingCode } = useRoomLive();
  const lang = useLang();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [avatarId, setAvatarId] = useState<string | null>(null);
  const [name, setName] = useState<string>("");
  const updatePresence = useUpdateMyPresence();
  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/?room=${code}`
      : "";

  // localStorage → state. Subscribe to writes (cross-tab + same-tab via
  // the custom event the settings drawer dispatches).
  useEffect(() => {
    const read = () => {
      setAvatarId(localStorage.getItem(AVATAR_KEY));
      setName(localStorage.getItem(NAME_KEY) ?? "");
    };
    read();
    const onStorage = (e: StorageEvent) => {
      if (e.key === AVATAR_KEY || e.key === NAME_KEY) read();
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
  const playing = nowPlayingCode ? getCountry(nowPlayingCode) : null;

  return (
    <header className="sticky top-0 z-30 backdrop-blur-md bg-dark-blue-900/70 border-b border-white/5">
      <div className="container mx-auto max-w-3xl px-4 h-14 flex items-center gap-3">
        {/* Brand / now-playing badge — morphs between the 70-heart and
            the active country's heart-flag SVG. Same slot, same size,
            so the page chrome stays still while the badge swaps. */}
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="relative h-8 w-8 shrink-0">
            <AnimatePresence mode="wait" initial={false}>
              {playing ? (
                <motion.div
                  key={`p-${playing.code}`}
                  initial={{ opacity: 0, scale: 0.6, rotate: -8 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  exit={{ opacity: 0, scale: 0.6, rotate: 8 }}
                  transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute inset-0 heartbeat-loop"
                >
                  <Flag code={playing.code} size="md" className="h-8 w-8" />
                </motion.div>
              ) : (
                <motion.div
                  key="brand"
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.6 }}
                  transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute inset-0 heartbeat-loop"
                >
                  <Image
                    src="/images/70-heart-sm.webp"
                    alt=""
                    width={32}
                    height={32}
                    priority
                    className="h-8 w-8 object-contain"
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="min-w-0 flex flex-col leading-tight">
            <AnimatePresence mode="wait" initial={false}>
              {playing ? (
                <motion.div
                  key={`np-${playing.code}`}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.22 }}
                  className="min-w-0"
                >
                  <p className="text-[10px] uppercase tracking-[0.32em] text-flamingo font-display leading-tight">
                    {t(lang, "now_playing")}
                  </p>
                  <p className="text-xs text-white/85 truncate">
                    <span className="font-display">{playing.name}</span>
                    {playing.artist && (
                      <span className="text-white/55"> · {playing.artist}</span>
                    )}
                  </p>
                </motion.div>
              ) : (
                <motion.p
                  key="brand-text"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-[11px] uppercase tracking-[0.32em] text-white/70 font-display"
                >
                  Vienna 2026
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Right-side identity: name + avatar tile. Whole pair is
            tappable → settings drawer. */}
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          aria-label="Settings"
          className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-full
                     hover:bg-white/[0.04] transition group"
        >
          {name && (
            <span className="font-display text-sm text-white/85 truncate max-w-[8rem]
                             group-hover:text-white transition">
              {name}
            </span>
          )}
          <span
            className="relative h-9 w-9 rounded-2xl overflow-hidden ring-1 ring-white/15
                       group-hover:ring-white/35 transition-shadow
                       shadow-[0_4px_12px_-4px_rgba(0,0,0,0.6)]"
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
          </span>
        </button>
      </div>

      <SettingsModal
        open={settingsOpen}
        onClose={() => {
          setSettingsOpen(false);
          setAvatarId(localStorage.getItem(AVATAR_KEY));
          const next = localStorage.getItem(AVATAR_KEY);
          updatePresence({ avatar: next });
        }}
        shareUrl={shareUrl}
      />
    </header>
  );
}
