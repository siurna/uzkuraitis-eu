"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useOthers, useUpdateMyPresence } from "@/lib/liveblocks";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { AvatarPicker } from "@/components/avatar-picker";
import { SelectedAvatarCard } from "@/components/selected-avatar-card";
import { LANGUAGES, LANGUAGE_NAMES, t, type Language } from "@/lib/i18n";
import { readLang, writeLang } from "@/lib/i18n-client";

const NAME_KEY = "uzk_name";
const AVATAR_KEY = "uzk_avatar";

// Two-step welcome gate:
//   step 1 — name + language. Drawer stays compact (auto-height).
//   step 2 — avatar grid. Drawer expands to ~78dvh so the grid scrolls.
//
// On step 2 we render a sticky "selected artist" card just above the
// footer so the picked face stays visible while the user scrolls the
// grid. No avatar pulse — the check pip + outline are enough.
export function NameGate({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [draftName, setDraftName] = useState("");
  const [draftAvatar, setDraftAvatar] = useState<string | null>(null);
  const [lang, setLang] = useState<Language>("lt");
  const updatePresence = useUpdateMyPresence();
  const others = useOthers();

  // Cheeky heads-up if someone in the room already goes by this name —
  // we don't block it, just nudge them to disambiguate.
  const nameTaken =
    draftName.trim().length > 0 &&
    others.some(
      (o) =>
        (o.presence?.name ?? "").trim().toLowerCase() ===
        draftName.trim().toLowerCase(),
    );

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
          // On step 2 the picked-artist card lives in the (fixed) footer
          // so it stays glued above the buttons — same pattern as the
          // settings avatar sheet, not "sticky" inside the scroll area
          // where it floated. Step dots are absolutely centred so they
          // don't shift when the Back button appears on step 2.
          <div className="w-full flex flex-col gap-3">
            {step === 2 && <SelectedAvatarCard avatarId={draftAvatar} />}
            <div className="relative flex items-center gap-3 w-full">
              {step === 2 ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setStep(1)}
                  className="text-white/70 px-2 shrink-0"
                  aria-label={t(lang, "back")}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              ) : (
                <span className="w-9 shrink-0" aria-hidden />
              )}
              <span className="pointer-events-none absolute left-1/2 -translate-x-1/2">
                <StepDots current={step} total={2} />
              </span>
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
          </div>
        }
      >
        {step === 1 ? (
          // Compact — sheet auto-sizes to content. No min-h.
          <form
            id="name-gate-step1"
            onSubmit={advance}
            className="flex flex-col gap-5 pt-2"
          >
            <div className="flex flex-col gap-2">
              <Input
                autoFocus
                value={draftName}
                onChange={(e) => setDraftName(e.target.value.slice(0, 40))}
                placeholder={t(lang, "your_name")}
                className="heartbeat-focus h-14 text-center text-2xl font-bold
                           rounded-xl border border-white/15 bg-black/30
                           placeholder:text-white/30 placeholder:font-normal"
                maxLength={40}
              />
              {nameTaken && (
                <p className="text-xs text-flamingo/90 text-center leading-snug px-1">
                  {t(lang, "name_taken_hint")}
                </p>
              )}
            </div>
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
          // Step 2 expands the sheet; the grid scrolls inside the
          // existing overflow container. The picked-artist card sits in
          // the footer (above), not inline here.
          <div className="flex flex-col gap-3 min-h-[60dvh]">
            <AvatarPicker value={draftAvatar} onChange={setDraftAvatar} />
          </div>
        )}
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
