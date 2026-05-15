"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Share2, Check, LogOut, ChevronRight, Bell, Languages, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
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
import { readLang, withLangTransition, writeLang } from "@/lib/i18n-client";
import { readBeginner, writeBeginner } from "@/lib/beginner-client";
import { readTranslate, writeTranslate } from "@/lib/translate-client";

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
  const router = useRouter();
  const [name, setName] = useState("");
  const lastGoodName = useRef("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [lang, setLang] = useState<Language>("lt");
  // Separate state for the pill's `left` so we can commit the pill
  // move BEFORE we open the view-transition that crossfades the
  // strings. The view-transition snapshots a frame where the pill
  // is already on its new side; the snapshot crossfade only animates
  // the surrounding labels. This is the only way to get "items
  // crossfade AND pill snaps" both true at once — the View
  // Transitions API itself can't be told to skip an element
  // reliably across browsers.
  const [pillSide, setPillSide] = useState<Language>("lt");
  const [beginner, setBeginner] = useState(false);
  const [translate, setTranslate] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [notifSheetOpen, setNotifSheetOpen] = useState(false);
  const [leaveSheetOpen, setLeaveSheetOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const initial = localStorage.getItem(NAME_KEY) ?? "";
    setName(initial);
    setBeginner(readBeginner());
    setTranslate(readTranslate());
    lastGoodName.current = initial;
    setAvatar(localStorage.getItem(AVATAR_KEY) ?? null);
    setLang(readLang());
    setPillSide(readLang());
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
    // The next heartbeat (≤30s) ships the new name to the server;
    // WhosHere picks it up on its next poll.
  };

  const setLanguage = (next: Language) => {
    // `flushSync` forces the pill state to render + commit to the
    // DOM synchronously, BEFORE `startViewTransition` opens the
    // snapshot. The earlier rAF version landed in the same animation
    // frame as React's commit so the snapshot still caught the OLD
    // pill position and the root crossfade dragged it along. With
    // flushSync the pill is GUARANTEED at its new left when the
    // capture happens, so only the surrounding strings crossfade.
    flushSync(() => {
      setPillSide(next);
    });
    withLangTransition(() => {
      setLang(next);
      writeLang(next);
    });
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
            <div className="relative grid grid-cols-2 gap-1 rounded-2xl bg-black/30 ring-1 ring-white/10 p-1">
              {/* Active-pill bg, driven by `pillSide` (NOT `lang`)
                  so the pill commits its new position on the frame
                  BEFORE the lang view-transition opens. No
                  view-transition-name needed — the pill is already
                  at its target left when the snapshot is taken, so
                  the snapshot crossfade has nothing to interpolate
                  for the pill. */}
              <span
                aria-hidden
                className="absolute top-1 bottom-1 w-[calc(50%-0.25rem)] rounded-xl bg-white pointer-events-none"
                style={{
                  left: pillSide === LANGUAGES[0] ? "0.25rem" : "50%",
                }}
              />
              {LANGUAGES.map((code) => {
                // Text colour tracks `pillSide` too so it flips
                // instantly when the user taps; the LANGUAGE_NAMES
                // labels themselves are language-agnostic (LT/EN)
                // and don't need to crossfade.
                const active = pillSide === code;
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setLanguage(code)}
                    className={`relative z-10 h-11 rounded-xl font-display text-base transition-colors ${
                      active ? "text-dark-blue" : "text-white/65"
                    }`}
                  >
                    <span>{LANGUAGE_NAMES[code]}</span>
                  </button>
                );
              })}
            </div>
          </Section>

          {/* In-chat helpers. Two parallel rows: auto-translate to
              English (LT → EN gloss) and Eurovision tips (cultural
              reference explainer). Same tile shape the notification
              prefs use elsewhere in the drawer: icon tile on the
              left, label + sub stacked, switch on the right. The
              old "neon" explainer card is gone, but the toggles
              themselves are back — they're the only way for a
              viewer to flip these features on. */}
          <div className="flex flex-col gap-2">
            {/* Auto-translate only makes sense when the viewer is
                reading the app in English — they'd want the LT chat
                glossed into EN. A Lithuanian-reading viewer doesn't
                need the gloss (the messages are already in their
                language); the toggle just adds noise to the drawer
                for them. So we render it only when lang === "en". */}
            {lang === "en" && (
              <PrefRow
                icon={<Languages className="h-5 w-5" />}
                title={t(lang, "settings_translate_h")}
                sub={t(lang, "settings_translate_sub")}
                value={translate}
                onChange={(next) => {
                  setTranslate(next);
                  writeTranslate(next);
                }}
              />
            )}
            <PrefRow
              icon={<Sparkles className="h-5 w-5" />}
              title={t(lang, "settings_beginner_h")}
              sub={t(lang, "settings_beginner_sub")}
              value={beginner}
              onChange={(next) => {
                setBeginner(next);
                writeBeginner(next);
              }}
            />
          </div>

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
                      <span className="italic">{selectedAvatar.song}</span>
                      {" · "}
                      {selectedAvatar.year}
                      {" · "}
                      {selectedAvatar.country.toUpperCase()}
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
                    // Heartbeat will fan the new avatar out to peers
                    // on its next 30s tick via WhosHere's REST poll.
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


// Toggle row used by the auto-translate + Eurovision tips prefs.
// Mirrors the notification-toggles PrefRow shape (icon tile on the
// left, label + sub stacked, switch on the right) so the in-chat
// helpers feel like one family with the notification prefs deeper
// in the drawer. Tile tints flamingo while ON to match.
function PrefRow({
  icon,
  title,
  sub,
  value,
  onChange,
}: {
  icon: React.ReactNode;
  title: string;
  sub?: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      aria-pressed={value}
      className="w-full flex items-center gap-3 rounded-2xl px-3 py-2.5
                 bg-white/5 ring-1 ring-white/10 hover:bg-white/10 transition text-left"
    >
      <span
        className={`shrink-0 grid place-items-center h-10 w-10 rounded-xl transition
                    ${value
                      ? "bg-flamingo/20 ring-1 ring-flamingo/40 text-flamingo"
                      : "bg-white/8 ring-1 ring-white/12 text-white/65"}`}
      >
        {icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block font-display text-sm text-white text-balance">{title}</span>
        {sub && (
          <span className="block text-[11px] text-white/55 leading-snug text-balance">
            {sub}
          </span>
        )}
      </span>
      <span
        className={`shrink-0 inline-flex items-center h-6 w-10 rounded-full transition
                    ${value ? "bg-success/90" : "bg-white/15"}`}
      >
        <span
          className={`block h-5 w-5 rounded-full bg-white transition-transform
                      ${value ? "translate-x-[18px]" : "translate-x-0.5"}`}
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
