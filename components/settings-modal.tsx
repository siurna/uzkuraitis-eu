"use client";

import { useEffect, useState } from "react";
import { Share2, Check } from "lucide-react";
import { toast } from "sonner";
import { useUpdateMyPresence } from "@/lib/liveblocks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { AvatarPicker } from "@/components/avatar-picker";
import {
  LANGUAGES,
  readLang,
  writeLang,
  t,
  type Language,
} from "@/lib/i18n";

const NAME_KEY = "uzk_name";
const AVATAR_KEY = "uzk_avatar";

// Bottom-sheet that lets the user re-edit their identity (name + avatar
// + language) AND share the room link, in one place. Replaces the old
// header share button.
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
    if (!clean) return;
    localStorage.setItem(NAME_KEY, clean);
    if (avatar) localStorage.setItem(AVATAR_KEY, avatar);
    else localStorage.removeItem(AVATAR_KEY);
    writeLang(lang);
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
            className="text-white/60"
          >
            {t(lang, "cancel")}
          </Button>
          <div className="flex-1" />
          <Button
            type="submit"
            form="settings-form"
            disabled={!name.trim()}
            className="bg-gradient-to-r from-gold via-flamingo to-purple text-white"
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
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-white/70">{t(lang, "your_name")}</span>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 40))}
            className="h-11"
            maxLength={40}
          />
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm text-white/70">{t(lang, "language")}</legend>
          <div className="inline-flex items-center gap-1 rounded-full bg-black/30 p-1 self-start">
            {LANGUAGES.map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setLang(code)}
                className={`px-4 py-1.5 rounded-full text-sm font-display uppercase tracking-widest transition ${
                  lang === code
                    ? "bg-flamingo text-white shadow-glow-pink"
                    : "text-white/60 hover:text-white"
                }`}
              >
                {code}
              </button>
            ))}
          </div>
        </fieldset>

        <AvatarPicker value={avatar} onChange={setAvatar} />

        <div className="border-t border-white/5 pt-4">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={share}
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 mr-1.5" />
                Copied
              </>
            ) : (
              <>
                <Share2 className="h-4 w-4 mr-1.5" />
                {t(lang, "share_link")}
              </>
            )}
          </Button>
        </div>
      </form>
    </BottomSheet>
  );
}
