"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useUpdateMyPresence } from "@/lib/liveblocks";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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

// Two-step welcome gate:
//   step 1 — name + language (required to continue).
//   step 2 — pick an avatar (optional; the user can skip it).
// Once submitted, identity is persisted to localStorage and mirrored
// into Liveblocks presence; subsequent visits skip the sheet entirely.
export function NameGate({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [draftName, setDraftName] = useState("");
  const [draftAvatar, setDraftAvatar] = useState<string | null>(null);
  const [lang, setLang] = useState<Language>("en");
  const updatePresence = useUpdateMyPresence();

  useEffect(() => {
    const storedName = localStorage.getItem(NAME_KEY);
    const storedAvatar = localStorage.getItem(AVATAR_KEY);
    if (storedName) {
      setName(storedName);
      setDraftName(storedName);
    }
    if (storedAvatar) {
      setAvatar(storedAvatar);
      setDraftAvatar(storedAvatar);
    }
    setLang(readLang());
    // Skip step 1 entirely when the visitor already has a name on
    // file (returning users picking an avatar for the first time).
    if (storedName && !storedAvatar) setStep(2);
    setHydrated(true);
  }, []);

  // Mirror name + avatar into Liveblocks presence so the rest of the room
  // sees the right tile against your initial.
  useEffect(() => {
    if (name) updatePresence({ name, avatar });
  }, [name, avatar, updatePresence]);

  const advance = (e?: React.FormEvent) => {
    e?.preventDefault();
    const cleanName = draftName.trim().slice(0, 40);
    if (!cleanName) return;
    writeLang(lang);
    setStep(2);
  };

  const finish = () => {
    const cleanName = draftName.trim().slice(0, 40);
    if (!cleanName || !draftAvatar) return;
    localStorage.setItem(NAME_KEY, cleanName);
    localStorage.setItem(AVATAR_KEY, draftAvatar);
    writeLang(lang);
    window.dispatchEvent(new Event("uzk:avatar-change"));
    setName(cleanName);
    setAvatar(draftAvatar);
  };

  if (!hydrated) return null;

  const open = !name || !avatar;

  return (
    <>
      {children}
      <BottomSheet
        open={open}
        onClose={() => {
          /* not dismissible without submit */
        }}
        dismissible={false}
        title={step === 1 ? t(lang, "welcome") : t(lang, "pick_avatar")}
        sub={step === 1 ? t(lang, "name_prompt") : undefined}
        footer={
          step === 1 ? (
            <Button
              type="submit"
              form="name-gate-step1"
              disabled={!draftName.trim()}
              className="w-full font-display rounded-2xl
                         bg-white text-dark-blue hover:bg-dark-blue-50
                         disabled:opacity-40"
            >
              {t(lang, "next")}
              <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep(1)}
                className="text-white/70"
              >
                <ArrowLeft className="h-4 w-4 mr-1.5" />
                {t(lang, "back")}
              </Button>
              <div className="flex-1" />
              <Button
                type="button"
                onClick={finish}
                disabled={!draftAvatar}
                className="font-display rounded-2xl
                           bg-white text-dark-blue hover:bg-dark-blue-50
                           disabled:opacity-40"
              >
                {t(lang, "join_party")}
              </Button>
            </>
          )
        }
      >
        {step === 1 ? (
          <form
            id="name-gate-step1"
            onSubmit={advance}
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
            <div className="flex items-center justify-center gap-1 rounded-full bg-black/30 p-1 self-center">
              {LANGUAGES.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLang(code)}
                  className={`px-4 py-1.5 rounded-full text-xs font-display transition ${
                    lang === code
                      ? "bg-white text-dark-blue"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  {LANGUAGE_NAMES[code]}
                </button>
              ))}
            </div>
            <StepDots current={1} total={2} />
          </form>
        ) : (
          <div className="flex flex-col gap-4">
            <AvatarPicker value={draftAvatar} onChange={setDraftAvatar} />
            <StepDots current={2} total={2} />
          </div>
        )}
      </BottomSheet>
    </>
  );
}

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-1.5 mt-1">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-1.5 rounded-full transition-all ${
            i + 1 === current ? "w-6 bg-white" : "w-1.5 bg-white/25"
          }`}
        />
      ))}
    </div>
  );
}
