"use client";

import { useEffect, useState } from "react";
import { useUpdateMyPresence } from "@/lib/liveblocks";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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

// Bottom-sheet "welcome" gate that asks for name + avatar + language on
// first room entry. Once dismissed, the chosen identity is persisted to
// localStorage and mirrored into Liveblocks presence; subsequent visits
// skip the sheet entirely.
export function NameGate({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftAvatar, setDraftAvatar] = useState<string | null>(null);
  const [lang, setLang] = useState<Language>("en");
  const updatePresence = useUpdateMyPresence();

  useEffect(() => {
    const storedName = localStorage.getItem(NAME_KEY);
    const storedAvatar = localStorage.getItem(AVATAR_KEY);
    if (storedName) setName(storedName);
    if (storedAvatar) setAvatar(storedAvatar);
    setLang(readLang());
    setHydrated(true);
  }, []);

  // Mirror name + avatar into Liveblocks presence so the rest of the room
  // sees the right tile against your initial.
  useEffect(() => {
    if (name) updatePresence({ name, avatar });
  }, [name, avatar, updatePresence]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = draftName.trim().slice(0, 40);
    if (!cleanName) return;
    localStorage.setItem(NAME_KEY, cleanName);
    if (draftAvatar) {
      localStorage.setItem(AVATAR_KEY, draftAvatar);
    } else {
      localStorage.removeItem(AVATAR_KEY);
    }
    writeLang(lang);
    setName(cleanName);
    setAvatar(draftAvatar);
  };

  if (!hydrated) return null;

  // Sheet stays mounted but only opens when no name is on file. Once
  // the user submits, the parent updates `name` and the sheet closes.
  // dismissible=false because the room is unusable without a name.
  return (
    <>
      {children}
      <BottomSheet
        open={!name}
        onClose={() => {
          /* not dismissible without submit */
        }}
        dismissible={false}
        title={t(lang, "welcome")}
        sub={t(lang, "name_prompt")}
        footer={
          <Button
            type="submit"
            form="name-gate-form"
            disabled={!draftName.trim()}
            className="w-full font-display
                       bg-gradient-to-r from-gold via-flamingo to-purple
                       text-white shadow-glow-pink
                       disabled:opacity-40 disabled:bg-none disabled:bg-white/10"
          >
            {t(lang, "join_party")}
          </Button>
        }
      >
        <form
          id="name-gate-form"
          onSubmit={submit}
          className="flex flex-col gap-4"
        >
          <Input
            autoFocus
            value={draftName}
            onChange={(e) => setDraftName(e.target.value.slice(0, 40))}
            placeholder={t(lang, "your_name")}
            className="h-12 text-center text-base"
            maxLength={40}
          />

          {/* Language toggle. Persists to localStorage; everywhere else
              in the user-facing app reads it via t(). */}
          <div className="flex items-center justify-center gap-1 rounded-full bg-black/30 p-1 self-center">
            {LANGUAGES.map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setLang(code)}
                className={`px-4 py-1 rounded-full text-xs font-display uppercase tracking-widest transition ${
                  lang === code
                    ? "bg-flamingo text-white shadow-glow-pink"
                    : "text-white/60 hover:text-white"
                }`}
              >
                {code}
              </button>
            ))}
          </div>

          <AvatarPicker value={draftAvatar} onChange={setDraftAvatar} />
        </form>
      </BottomSheet>
    </>
  );
}
