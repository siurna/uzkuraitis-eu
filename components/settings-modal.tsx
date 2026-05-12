"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Share2, Check, LogOut, ChevronRight, Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useUpdateMyPresence } from "@/lib/liveblocks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { AvatarPicker } from "@/components/avatar-picker";
import { SelectedAvatarCard } from "@/components/selected-avatar-card";
import { NotificationToggles } from "@/components/notification-toggles";
import { getAvatar } from "@/lib/avatars";
import { optimizedSrc } from "@/lib/img";
import {
  LANGUAGES,
  LANGUAGE_NAMES,
  readLang,
  writeLang,
  t,
  type Language,
} from "@/lib/i18n";

const NAME_KEY = "uzk_name";
const AVATAR_KEY = "uzk_avatar";
const LAST_ROOM_KEY = "uzk_last_room";

// Settings drawer: edit name / avatar / language, share the room
// link, leave the room. The avatar section collapses to a single
// summary card; tapping opens a separate avatar-picker bottom-sheet
// on top — keeps the settings drawer scannable instead of dumping
// the whole 42-tile grid inline.
export function SettingsModal({
  open,
  onClose,
  shareUrl,
}: {
  open: boolean;
  onClose: () => void;
  shareUrl: string;
}) {
  const updatePresence = useUpdateMyPresence();
  const router = useRouter();
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [lang, setLang] = useState<Language>("lt");
  const [copied, setCopied] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [notifSheetOpen, setNotifSheetOpen] = useState(false);
  const [leaveSheetOpen, setLeaveSheetOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(localStorage.getItem(NAME_KEY) ?? "");
    setAvatar(localStorage.getItem(AVATAR_KEY) ?? null);
    setLang(readLang());
    setCopied(false);
  }, [open]);

  const save = (e?: React.FormEvent) => {
    e?.preventDefault();
    const clean = name.trim().slice(0, 40);
    if (!clean || !avatar) return;
    localStorage.setItem(NAME_KEY, clean);
    localStorage.setItem(AVATAR_KEY, avatar);
    writeLang(lang);
    window.dispatchEvent(new Event("uzk:avatar-change"));
    updatePresence({ name: clean, avatar });
    toast.success(t(lang, "save"));
    onClose();
  };

  const share = async () => {
    if (!shareUrl) return;
    // Native share sheet first (iOS/Android/Edge), fallback to clipboard.
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title: t(lang, "share_link"), url: shareUrl });
        return;
      } catch {
        /* user cancelled; fall through to clipboard */
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success(t(lang, "link_copied"));
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error(t(lang, "couldnt_copy"));
    }
  };

  const leaveRoom = () => {
    localStorage.removeItem(LAST_ROOM_KEY);
    router.push("/?leave=1");
  };

  const selectedAvatar = getAvatar(avatar);

  return (
    <>
      <BottomSheet
        open={open}
        onClose={onClose}
        title={t(lang, "settings")}
        footer={
          <>
            <Button
              type="button"
              variant="ghost"
              onClick={share}
              className="text-white/75 gap-1.5"
            >
              {copied ? <Check className="h-4 w-4 text-success" /> : <Share2 className="h-4 w-4" />}
              {copied ? t(lang, "link_copied") : t(lang, "share_link")}
            </Button>
            <div className="flex-1" />
            <Button
              type="submit"
              form="settings-form"
              disabled={!name.trim() || !avatar}
              className="font-display rounded-2xl
                         bg-white text-dark-blue hover:bg-dark-blue-50
                         disabled:opacity-40"
            >
              {t(lang, "save")}
            </Button>
          </>
        }
      >
        <form
          id="settings-form"
          onSubmit={save}
          className="flex flex-col gap-5"
        >
          <Section label={t(lang, "your_name")}>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 40))}
              className="heartbeat-focus h-14 text-center text-2xl font-bold rounded-xl
                         border border-white/15 bg-black/30 placeholder:text-white/30 placeholder:font-normal"
              maxLength={40}
            />
          </Section>

          <Section label={t(lang, "language")}>
            <div className="grid grid-cols-2 gap-1 rounded-2xl bg-black/30 ring-1 ring-white/10 p-1">
              {LANGUAGES.map((code) => {
                const active = lang === code;
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setLang(code)}
                    className="relative h-11 rounded-xl font-display text-base"
                  >
                    {active && (
                      <motion.span
                        layoutId="lang-pill"
                        className="absolute inset-0 rounded-xl bg-white"
                        transition={{ type: "spring", stiffness: 380, damping: 32 }}
                      />
                    )}
                    <span className={`relative transition-colors ${active ? "text-dark-blue" : "text-white/65"}`}>
                      {LANGUAGE_NAMES[code]}
                    </span>
                  </button>
                );
              })}
            </div>
          </Section>

          <Section label={t(lang, "pick_avatar")}>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="flex items-center gap-3 rounded-2xl px-3 py-2.5
                         bg-white/5 ring-1 ring-white/10 hover:bg-white/10 transition text-left"
            >
              {selectedAvatar?.photo ? (
                <span className="relative h-12 w-12 rounded-xl overflow-hidden ring-1 ring-white/15 shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={optimizedSrc(selectedAvatar.photo, 128)}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                    style={{
                      objectPosition: selectedAvatar.focal
                        ? `${selectedAvatar.focal.x}% ${selectedAvatar.focal.y}%`
                        : "50% 30%",
                    }}
                  />
                </span>
              ) : (
                <span className="h-12 w-12 rounded-xl bg-white/8 ring-1 ring-white/15 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                {selectedAvatar ? (
                  <>
                    <p className="font-display truncate">{selectedAvatar.artist}</p>
                    <p className="text-xs text-white/55 truncate">
                      {selectedAvatar.year} ·{" "}
                      <span className="italic">{selectedAvatar.song}</span>
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-white/55 italic">
                    {t(lang, "tap_to_pick")}
                  </p>
                )}
              </div>
              <ChevronRight className="h-4 w-4 text-white/30 shrink-0" />
            </button>
          </Section>

          <Section label="">
            <button
              type="button"
              onClick={() => setNotifSheetOpen(true)}
              className="flex items-center gap-3 rounded-2xl px-4 py-3
                         bg-white/5 ring-1 ring-white/10 hover:bg-white/10 transition text-left"
            >
              <Bell className="h-4 w-4 text-white/55 shrink-0" />
              <span className="flex-1">{t(lang, "notifications")}</span>
              <ChevronRight className="h-4 w-4 text-white/30 shrink-0" />
            </button>
            <button
              type="button"
              onClick={() => setLeaveSheetOpen(true)}
              className="flex items-center gap-3 rounded-2xl px-4 py-3
                         bg-white/5 ring-1 ring-white/10 hover:bg-white/10
                         text-error/90 hover:text-error transition text-left"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              <span className="flex-1">{t(lang, "leave_room")}</span>
            </button>
          </Section>
        </form>
      </BottomSheet>

      {/* Separate sheet for the avatar grid — opens on top of the
          settings drawer, no inline grid blowing up the layout. */}
      <BottomSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title={t(lang, "pick_avatar")}
        footer={
          // The picked-artist card lives in the (fixed) footer so it
          // genuinely stays glued above the Done button — not "sticky"
          // inside the scroll area where the scroll-edge fade nibbled it.
          <div className="w-full flex flex-col gap-3">
            <SelectedAvatarCard avatarId={avatar} />
            <div className="flex items-center">
              <div className="flex-1" />
              <Button
                type="button"
                onClick={() => setPickerOpen(false)}
                disabled={!avatar}
                className="font-display rounded-2xl
                           bg-white text-dark-blue hover:bg-dark-blue-50
                           disabled:opacity-40"
              >
                {t(lang, "done")}
              </Button>
            </div>
          </div>
        }
      >
        <div className="flex flex-col gap-3 min-h-[55dvh]">
          <AvatarPicker value={avatar} onChange={setAvatar} />
        </div>
      </BottomSheet>

      {/* Notifications — its own roomy sheet so the toggles each get a
          line of explanation instead of being crammed into settings. */}
      <BottomSheet
        open={notifSheetOpen}
        onClose={() => setNotifSheetOpen(false)}
        title={t(lang, "notifications")}
        sub={t(lang, "push_cta_sub")}
        footer={
          <>
            <div className="flex-1" />
            <Button
              type="button"
              onClick={() => setNotifSheetOpen(false)}
              className="font-display rounded-2xl bg-white text-dark-blue hover:bg-dark-blue-50"
            >
              {t(lang, "done")}
            </Button>
          </>
        }
      >
        <NotificationToggles />
      </BottomSheet>

      {/* Leave-room confirmation — a deliberate second step so a stray
          tap doesn't yank you out of an in-progress show. */}
      <BottomSheet
        open={leaveSheetOpen}
        onClose={() => setLeaveSheetOpen(false)}
        title={t(lang, "leave_confirm")}
        sub={t(lang, "leave_confirm_sub")}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setLeaveSheetOpen(false)} className="text-white/70">
              {t(lang, "cancel")}
            </Button>
            <div className="flex-1" />
            <Button
              type="button"
              onClick={leaveRoom}
              className="bg-error text-white hover:bg-error/90 rounded-2xl"
            >
              <LogOut className="h-4 w-4 mr-1.5" />
              {t(lang, "leave_yes")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-white/60 leading-relaxed">{t(lang, "leave_confirm_body")}</p>
      </BottomSheet>
    </>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      {label && (
        <h3 className="text-[11px] uppercase tracking-[0.2em] text-white/45 font-display">
          {label}
        </h3>
      )}
      {children}
    </section>
  );
}
