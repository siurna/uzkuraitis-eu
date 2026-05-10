"use client";

import { useEffect, useState } from "react";
import { Share2, Check, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useUpdateMyPresence } from "@/lib/liveblocks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { AvatarPicker } from "@/components/avatar-picker";
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
// link, leave the room. Sectioned so the eye doesn't have to hunt for
// a control, with consistent white-button styling matching the ESC
// 2026 poster CTA.
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
  const [lang, setLang] = useState<Language>("en");
  const [copied, setCopied] = useState(false);

  // Hydrate from localStorage on every open, so cancel-without-saving
  // really cancels (we don't carry stale draft state across opens).
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
    const payload = { title: t(lang, "share_link"), url: shareUrl };
    if (navigator.share) {
      try {
        await navigator.share(payload);
        return;
      } catch {
        /* user cancelled */
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy link");
    }
  };

  const leaveRoom = () => {
    localStorage.removeItem(LAST_ROOM_KEY);
    router.push("/?leave=1");
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t(lang, "settings")}
      footer={
        <>
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="text-white/70"
          >
            {t(lang, "cancel")}
          </Button>
          <div className="flex-1" />
          <Button
            type="submit"
            form="settings-form"
            disabled={!name.trim()}
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
            className="h-11"
            maxLength={40}
          />
        </Section>

        <Section label={t(lang, "language")}>
          <div className="inline-flex items-center gap-1 rounded-full bg-black/30 p-1 self-start">
            {LANGUAGES.map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setLang(code)}
                className={`px-4 py-1.5 rounded-full text-sm font-display transition ${
                  lang === code
                    ? "bg-white text-dark-blue"
                    : "text-white/60 hover:text-white"
                }`}
              >
                {LANGUAGE_NAMES[code]}
              </button>
            ))}
          </div>
        </Section>

        <Section label={t(lang, "pick_avatar")}>
          <AvatarPicker value={avatar} onChange={setAvatar} />
        </Section>

        <Section label="">
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={share}
              className="flex items-center justify-between rounded-2xl px-4 py-3
                         bg-white/5 ring-1 ring-white/10 hover:bg-white/10 transition"
            >
              <span className="flex items-center gap-2 text-sm">
                {copied ? (
                  <Check className="h-4 w-4 text-success" />
                ) : (
                  <Share2 className="h-4 w-4 text-white/70" />
                )}
                {copied ? "Copied" : t(lang, "share_link")}
              </span>
              <span className="text-xs text-white/40 truncate max-w-[12rem]">
                {shareUrl.replace(/^https?:\/\//, "")}
              </span>
            </button>
            <button
              type="button"
              onClick={leaveRoom}
              className="flex items-center gap-2 rounded-2xl px-4 py-3
                         bg-white/5 ring-1 ring-white/10 hover:bg-white/10
                         text-error/90 hover:text-error text-sm transition"
            >
              <LogOut className="h-4 w-4" />
              Leave room
            </button>
          </div>
        </Section>
      </form>
    </BottomSheet>
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
