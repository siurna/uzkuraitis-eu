"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "motion/react";
import { Settings as SettingsIcon } from "lucide-react";
import { useUpdateMyPresence } from "@/lib/realtime";
import { useIdentity } from "@/lib/use-identity";
import { useRoomLive } from "@/components/room-shell";
import { SettingsModal } from "@/components/settings-modal";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { NotificationToggles } from "@/components/notification-toggles";
import { Flag } from "@/components/flag";
import { useCountryDeepDive } from "@/components/country-deep-dive";
import { getCountry, countryName } from "@/lib/countries";
import { t } from "@/lib/i18n";
import { useLang } from "@/lib/i18n-client";

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
  const { code, nowPlayingCode, showStatus } = useRoomLive();
  const lang = useLang();
  const { name, avatarId, avatar } = useIdentity();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notifOnlyOpen, setNotifOnlyOpen] = useState(false);

  // Let other surfaces (the chat "turn on notifications" broadcast
  // card) request a specific drawer. Two events:
  //   uzk:open-settings  → opens the full Settings drawer
  //   uzk:open-notifications-only → opens JUST the notifications sheet,
  //                                no big Settings drawer behind it
  useEffect(() => {
    const onOpenSettings = () => setSettingsOpen(true);
    const onOpenNotifsOnly = () => setNotifOnlyOpen(true);
    window.addEventListener("uzk:open-settings", onOpenSettings);
    window.addEventListener("uzk:open-notifications-only", onOpenNotifsOnly);
    return () => {
      window.removeEventListener("uzk:open-settings", onOpenSettings);
      window.removeEventListener("uzk:open-notifications-only", onOpenNotifsOnly);
    };
  }, []);
  const updatePresence = useUpdateMyPresence();
  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/?room=${code}`
      : "";

  // Mirror identity into Liveblocks presence so other voters' bars +
  // honeycomb update when we change name/avatar.
  useEffect(() => {
    if (name) updatePresence({ name, avatar: avatarId });
  }, [name, avatarId, updatePresence]);

  const deepDive = useCountryDeepDive();
  // Only treat a country as "on stage" while the show status is
  // in_progress — a break or "not started" shouldn't keep showing the
  // last act in the header.
  const playing =
    showStatus === "in_progress" && nowPlayingCode
      ? getCountry(nowPlayingCode)
      : null;

  return (
    <header
      className="uzk-edge-bar fixed top-0 left-0 z-30 backdrop-blur-md bg-dark-blue-900/80 border-b border-white/5 overflow-x-hidden"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="container mx-auto max-w-3xl px-4 h-14 flex items-center gap-3">
        {/* Brand / now-playing badge — morphs between the 70-heart and
            the active country's heart-flag SVG. When a country's on
            stage the whole cluster is tappable → opens its deep-dive
            sheet (artist / song info). */}
        <button
          type="button"
          disabled={!playing}
          onClick={() => playing && deepDive.open(playing.code)}
          className="flex items-center gap-2.5 flex-1 min-w-0 text-left disabled:cursor-default"
          aria-label={
            playing ? `What's on stage: ${playing.name}` : undefined
          }
        >
          <div className="shrink-0 flex flex-col items-center">
          <div className="relative h-8 w-8">
            <AnimatePresence mode="wait" initial={false}>
              {playing ? (
                <motion.div
                  key={`p-${playing.code}`}
                  initial={{ opacity: 0, scale: 0.6, rotate: -8 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  exit={{ opacity: 0, scale: 0.6, rotate: 8 }}
                  transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute inset-0 heartbeat"
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
                  className="absolute inset-0"
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
                    <span className="font-display">{countryName(playing.code, lang)}</span>
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
        </button>

        {/* Right-side identity: name + avatar tile. Whole pair is
            tappable → settings drawer. */}
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          aria-label={t(lang, "settings")}
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
        onClose={() => setSettingsOpen(false)}
        shareUrl={shareUrl}
      />

      {/* Standalone notifications drawer — the chat broadcast card fires
          uzk:open-notifications-only to open this WITHOUT also opening
          the full Settings drawer behind it. */}
      <BottomSheet
        open={notifOnlyOpen}
        onClose={() => setNotifOnlyOpen(false)}
        title={t(lang, "notifications")}
        sub={t(lang, "push_cta_sub")}
      >
        <NotificationToggles />
      </BottomSheet>
    </header>
  );
}
