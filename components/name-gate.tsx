"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import Image from "next/image";
import { useUpdateMyPresence } from "@/lib/liveblocks";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { AvatarPicker } from "@/components/avatar-picker";
import { getAvatar } from "@/lib/avatars";
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
//   step 1 — name + language.
//   step 2 — avatar.
// Both steps share a min-h on the body so the sheet stays the same
// height across steps (no awkward grow-on-Next animation).
// Footer carries the step dots + Back/Next/Join — and on step 2,
// also a static "your name + heart" identity strip so the picked
// face has somewhere to belong while it pulses up in the grid.
export function NameGate({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [draftName, setDraftName] = useState("");
  const [draftAvatar, setDraftAvatar] = useState<string | null>(null);
  const [lang, setLang] = useState<Language>("lt");
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
    if (storedName && !storedAvatar) setStep(2);
    setHydrated(true);
  }, []);

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
  const draftAvatarObj = getAvatar(draftAvatar);

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
          <div className="flex items-center gap-3 w-full">
            {step === 2 && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep(1)}
                className="text-white/70 px-2 shrink-0"
                aria-label={t(lang, "back")}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            {/* On step 2 the footer doubles as a static identity strip
                — heart-mark + your name — anchoring the picked face
                while it pulses in the grid above. */}
            {step === 2 && draftName ? (
              <div className="flex-1 min-w-0 flex items-center gap-2">
                <Image
                  src="/images/70-heart-sm.webp"
                  alt=""
                  width={28}
                  height={28}
                  className="h-7 w-7 object-contain shrink-0"
                />
                <p className="font-display text-sm truncate">{draftName}</p>
              </div>
            ) : (
              <div className="flex-1" />
            )}
            <StepDots current={step} total={2} />
            <div className="flex-1" />
            {step === 1 ? (
              <Button
                type="submit"
                form="name-gate-step1"
                disabled={!draftName.trim()}
                className="font-display rounded-2xl
                           bg-white text-dark-blue hover:bg-dark-blue-50
                           disabled:opacity-40"
              >
                {t(lang, "next")}
                <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            ) : (
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
            )}
          </div>
        }
      >
        {/* min-h keeps the sheet a consistent height across both
            steps — no awkward grow animation when advancing to the
            avatar grid. */}
        <div className="min-h-[58dvh] flex flex-col">
          {step === 1 ? (
            <form
              id="name-gate-step1"
              onSubmit={advance}
              className="flex flex-col gap-5 pt-4"
            >
              <Input
                autoFocus
                value={draftName}
                onChange={(e) => setDraftName(e.target.value.slice(0, 40))}
                placeholder={t(lang, "your_name")}
                className="heartbeat-focus h-14 text-center text-2xl rounded-xl
                           border border-white/15 bg-black/30 placeholder:text-white/30"
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
            </form>
          ) : (
            <div className="flex-1 flex flex-col gap-3">
              <AvatarPicker
                value={draftAvatar}
                onChange={setDraftAvatar}
                pulseSelected
              />
              {/* Quiet caption: artist + year + song for the picked
                  face. Sits below the grid so the eye lands on the
                  heartbeat first. */}
              {draftAvatarObj && (
                <p className="text-xs text-white/55 text-center px-3 pt-1">
                  <span className="font-display text-white/80">
                    {draftAvatarObj.artist}
                  </span>
                  {" · "}
                  {draftAvatarObj.year}
                  {" · "}
                  <span className="italic">{draftAvatarObj.song}</span>
                </p>
              )}
            </div>
          )}
        </div>
      </BottomSheet>
    </>
  );
}

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-1.5 shrink-0">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-1.5 rounded-full transition-all ${
            i + 1 === current ? "w-5 bg-white" : "w-1.5 bg-white/25"
          }`}
        />
      ))}
    </div>
  );
}
