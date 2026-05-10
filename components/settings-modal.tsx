"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Share2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { useUpdateMyPresence } from "@/lib/liveblocks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AvatarPicker } from "@/components/avatar-picker";
import { LANGUAGES, type Language, readLang, writeLang, t } from "@/lib/i18n";

const NAME_KEY = "uzk_name";
const AVATAR_KEY = "uzk_avatar";

// Bottom-sheet settings modal opened from the cog icon in the room
// header. Lets the user re-edit their name + avatar + language and
// share the room link, all in one place.
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

  // Hydrate from localStorage every time the sheet opens (fresh start).
  useEffect(() => {
    if (!open) return;
    setName(localStorage.getItem(NAME_KEY) ?? "");
    setAvatar(localStorage.getItem(AVATAR_KEY) ?? null);
    setLang(readLang());
  }, [open]);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
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
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success("Link copied");
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="sheet"
          className="fixed inset-0 z-50 flex flex-col justify-end"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="absolute inset-0 bg-dark-blue-900/70 backdrop-blur-sm"
          />
          <motion.form
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            onSubmit={save}
            className="relative glass-card rounded-t-3xl border-x-0 border-b-0 max-h-[92vh] flex flex-col"
          >
            <div className="flex justify-center pt-2 pb-1 shrink-0">
              <div className="h-1 w-10 rounded-full bg-white/20" />
            </div>
            <div className="px-5 pb-3 flex items-start gap-3 shrink-0">
              <div className="flex-1 min-w-0">
                <h2 className="font-display text-xl gradient-text">
                  {t(lang, "settings")}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="text-white/50 hover:text-white p-1 -m-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto px-5 pb-5 flex flex-col gap-5">
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
                <legend className="text-sm text-white/70">
                  {t(lang, "language")}
                </legend>
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
            </div>

            <div className="px-5 py-3 border-t border-white/5 shrink-0 flex items-center gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                className="text-white/60"
              >
                Cancel
              </Button>
              <div className="flex-1" />
              <Button
                type="submit"
                disabled={!name.trim()}
                className="bg-gradient-to-r from-gold via-flamingo to-purple text-white"
              >
                {t(lang, "save")}
              </Button>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
