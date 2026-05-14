"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Share2, Check, LogOut, ChevronRight, Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import { useUpdateMyPresence } from "@/lib/realtime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { AvatarPicker } from "@/components/avatar-picker";
import { SelectedAvatarCard } from "@/components/selected-avatar-card";
import { NotificationToggles } from "@/components/notification-toggles";
import { FluentEmoji } from "@/components/fluent-emoji";
import { getAvatar } from "@/lib/avatars";
import { optimizedSrc } from "@/lib/img";
import { LANGUAGES, LANGUAGE_NAMES, t, type Language } from "@/lib/i18n";
import { readLang, writeLang } from "@/lib/i18n-client";
import { readTranslate, writeTranslate } from "@/lib/translate-client";
import { readBeginner, writeBeginner } from "@/lib/beginner-client";

const NAME_KEY = "uzk_name";
const AVATAR_KEY = "uzk_avatar";
const LAST_ROOM_KEY = "uzk_last_room";

// Settings drawer: edit name / avatar / language, share the room
// link, leave the room. Autosaves everything — toggles persist on
// flip, the name persists on blur (empty rolls back to the last good
// value). No footer, no Save button.
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
  const lastGoodName = useRef("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [lang, setLang] = useState<Language>("lt");
  const [copied, setCopied] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [notifSheetOpen, setNotifSheetOpen] = useState(false);
  const [leaveSheetOpen, setLeaveSheetOpen] = useState(false);
  const [translate, setTranslate] = useState(false);
  const [beginner, setBeginner] = useState(false);

  useEffect(() => {
    if (!open) return;
    const initial = localStorage.getItem(NAME_KEY) ?? "";
    setName(initial);
    lastGoodName.current = initial;
    setAvatar(localStorage.getItem(AVATAR_KEY) ?? null);
    setLang(readLang());
    setTranslate(readTranslate());
    setBeginner(readBeginner());
    setCopied(false);
  }, [open]);

  useEffect(() => {
    const onOpenNotifs = () => {
      if (open) setNotifSheetOpen(true);
    };
    window.addEventListener("uzk:open-notifications", onOpenNotifs);
    return () => window.removeEventListener("uzk:open-notifications", onOpenNotifs);
  }, [open]);

  const commitName = () => {
    const clean = name.trim().slice(0, 40);
    if (!clean) {
      // Empty isn't allowed — roll back to the last good value so we
      // never persist a nameless identity that would show up as
      // "anonymous" in chat.
      setName(lastGoodName.current);
      return;
    }
    if (clean === lastGoodName.current) return;
    lastGoodName.current = clean;
    localStorage.setItem(NAME_KEY, clean);
    updatePresence({ name: clean });
  };

  const setLanguage = (next: Language) => {
    setLang(next);
    writeLang(next);
  };

  const toggleTranslate = () => {
    const next = !translate;
    setTranslate(next);
    writeTranslate(next);
  };

  const toggleBeginner = () => {
    const next = !beginner;
    setBeginner(next);
    writeBeginner(next);
  };

  const share = async () => {
    if (!shareUrl) return;
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title: t(lang, "share_link"), url: shareUrl });
        return;
      } catch {
        /* user cancelled */
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard refused — user can long-press the address bar */
    }
  };

  const leaveRoom = () => {
    localStorage.removeItem(LAST_ROOM_KEY);
    router.push("/?leave=1");
  };

  const selectedAvatar = getAvatar(avatar);

  return (
    <>
      <BottomSheet open={open} onClose={onClose} title={t(lang, "settings")}>
        <div className="flex flex-col gap-5">
          <Section label={t(lang, "your_name")}>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 40))}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  (e.target as HTMLInputElement).blur();
                }
              }}
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
                    onClick={() => setLanguage(code)}
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

          <AnimatePresence initial={false}>
            {lang === "en" && (
              <motion.div
                key="translate-section"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <Section label={t(lang, "settings_translate_h")}>
                  <ToggleRow
                    on={translate}
                    onChange={toggleTranslate}
                    label={t(lang, "settings_translate_sub")}
                  />
                </Section>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Beginner mode: when ON, a turquoise gloss-bubble slides
              in underneath the toggle as a live preview of what the
              feature will drop into chat. Reads as "this is the thing
              you just enabled" instead of a silent flag flip. */}
          <Section label={t(lang, "settings_beginner_h")}>
            <ToggleRow
              on={beginner}
              onChange={toggleBeginner}
              label={t(lang, "settings_beginner_sub")}
            />
            <AnimatePresence initial={false}>
              {beginner && (
                <motion.div
                  key="beginner-preview"
                  initial={{ opacity: 0, height: 0, y: -6 }}
                  animate={{ opacity: 1, height: "auto", y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -6 }}
                  transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <div className="mt-2 rounded-2xl bg-turquoise/12 ring-1 ring-turquoise/35 px-3 py-2.5 flex items-start gap-2.5">
                    <FluentEmoji glyph="💡" size={18} className="mt-0.5 shrink-0" />
                    <p className="text-[13px] text-turquoise leading-snug">
                      {t(lang, "settings_beginner_sub")}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
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
                    src={optimizedSrc(selectedAvatar.photo, 256)}
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
              <ChevronRight className="h-4 w-4 text-dark-blue-300 shrink-0" />
            </button>
          </Section>

          {/* Menu rail: Share link, Notifications, Leave room — three
              tap-out items that used to live in the footer or be
              implicit. Share lives here now so the drawer has no
              fixed-footer at all. */}
          <Section label="">
            <button
              type="button"
              onClick={share}
              disabled={!shareUrl}
              className="flex items-center gap-3 rounded-2xl px-4 py-3
                         bg-white/5 ring-1 ring-white/10 hover:bg-white/10 transition text-left
                         disabled:opacity-50"
            >
              {copied ? (
                <Check className="h-4 w-4 text-success shrink-0" />
              ) : (
                <Share2 className="h-4 w-4 text-dark-blue-200 shrink-0" />
              )}
              <span className="flex-1">
                {copied ? t(lang, "link_copied") : t(lang, "share_link")}
              </span>
              <ChevronRight className="h-4 w-4 text-dark-blue-300 shrink-0" />
            </button>
            <button
              type="button"
              onClick={() => setNotifSheetOpen(true)}
              className="flex items-center gap-3 rounded-2xl px-4 py-3
                         bg-white/5 ring-1 ring-white/10 hover:bg-white/10 transition text-left"
            >
              <Bell className="h-4 w-4 text-dark-blue-200 shrink-0" />
              <span className="flex-1">{t(lang, "notifications")}</span>
              <ChevronRight className="h-4 w-4 text-dark-blue-300 shrink-0" />
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
        </div>
      </BottomSheet>

      <BottomSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title={t(lang, "pick_avatar")}
        footer={
          <div className="w-full flex flex-col gap-3">
            <SelectedAvatarCard avatarId={avatar} />
            <div className="flex items-center">
              <div className="flex-1" />
              <Button
                type="button"
                onClick={() => {
                  if (avatar) {
                    localStorage.setItem(AVATAR_KEY, avatar);
                    updatePresence({ avatar });
                    window.dispatchEvent(new Event("uzk:avatar-change"));
                  }
                  setPickerOpen(false);
                }}
                disabled={!avatar}
                className="font-display rounded-2xl
                           bg-white text-dark-blue hover:bg-dark-blue-50
                           disabled:opacity-40"
              >
                {t(lang, "pick_avatar_apply")}
              </Button>
            </div>
          </div>
        }
      >
        <div className="flex flex-col gap-3 min-h-[55dvh]">
          <AvatarPicker value={avatar} onChange={setAvatar} />
        </div>
      </BottomSheet>

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

function ToggleRow({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      aria-pressed={on}
      className="w-full flex items-center gap-3 rounded-2xl px-4 py-3
                 bg-white/[0.04] ring-1 ring-white/8 hover:bg-white/[0.07] transition text-left"
    >
      <span className="flex-1 min-w-0">
        <span className="block text-sm text-white/90 leading-snug">{label}</span>
      </span>
      <span
        className={`relative h-6 w-11 rounded-full transition shrink-0 ${
          on ? "bg-success/70" : "bg-white/10"
        }`}
        aria-hidden
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition transform ${
            on ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </span>
    </button>
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
