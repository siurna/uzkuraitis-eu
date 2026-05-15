"use client";

import { useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useParticipants } from "@/lib/use-participants";
import { ensureSessionId, SESSION_KEY } from "@/lib/use-identity";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { AvatarPicker } from "@/components/avatar-picker";
import { AvatarMatrixBg } from "@/components/avatar-matrix-bg";
import { SelectedAvatarCard } from "@/components/selected-avatar-card";
import { FluentEmoji } from "@/components/fluent-emoji";
import {
  detectPlatform,
  isInstalledPwa,
} from "@/components/notification-toggles";
import { getState, subscribe, isSupported } from "@/lib/push-client";
import { LANGUAGES, LANGUAGE_NAMES, t, type Language } from "@/lib/i18n";
import { readLang, withLangTransition, writeLang } from "@/lib/i18n-client";

const NAME_KEY = "uzk_name";
const AVATAR_KEY = "uzk_avatar";

// Default prefs for the on-gate subscribe. Mirrors NotificationToggles'
// DEFAULT_PREFS so a fresh subscriber lands on the same "useful only"
// preset whether they opt-in here or from Settings.
const ONBOARD_PREFS = {
  chatAll: false,
  chatReplies: true,
  nowPlaying: true,
  votingState: true,
  resultsTallied: true,
} as const;

// Two-step welcome gate:
//   step 1 — name + language. Drawer stays compact (auto-height).
//   step 2 — avatar grid. Drawer expands to ~78dvh so the grid scrolls.
//
// On step 2 we render a sticky "selected artist" card just above the
// footer so the picked face stays visible while the user scrolls the
// grid. No avatar pulse — the check pip + outline are enough.
// NameGate sits OUTSIDE RoomLiveProvider in the room shell (it's the
// gate that runs BEFORE the room state is built), so it can't reach
// the room code via `useRoomLive()`. The shell threads the code in
// as a prop instead — it already has it from the route params.
export function NameGate({
  code: roomCode,
  children,
}: {
  code: string;
  children: React.ReactNode;
}) {
  const [hydrated, setHydrated] = useState(false);
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  // Step 3 (notifications) only appears once name + avatar are committed.
  // While the user is still on the welcome flow we render steps 1 and 2;
  // step 3 is the "okay you're in, want pings?" sheet that pops as soon
  // as the gate would otherwise close.
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [draftName, setDraftName] = useState("");
  const [draftAvatar, setDraftAvatar] = useState<string | null>(null);
  const [lang, setLang] = useState<Language>("lt");
  // Pill-side mirror of `lang` — committed synchronously via
  // flushSync BEFORE the view-transition snapshot opens so the
  // toggle pops to the new side instead of riding the root crossfade.
  const [pillSide, setPillSide] = useState<Language>("lt");
  const [pushOnboardComplete, setPushOnboardComplete] = useState(false);
  const participants = useParticipants(roomCode);
  const platform = useMemo(() => detectPlatform(), []);

  // Cheeky heads-up if someone in the room already goes by this name —
  // we don't block it, just nudge them to disambiguate. Reads from
  // the REST participants list (driven by every viewer's heartbeat
  // upsert into the voters table); ~20s latency is fine here, the
  // user is mid-name-entry anyway and a second-tick freshness on
  // the name-collision hint isn't load-bearing.
  const nameTaken =
    draftName.trim().length > 0 &&
    participants.some(
      (p) =>
        p.name.trim().toLowerCase() === draftName.trim().toLowerCase(),
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
    setPillSide(readLang());
    if (storedName && !storedAvatar) setStep(2);
    setHydrated(true);
  }, []);

  // Identity used to fan out via Supabase presence here. Now name +
  // avatar persist to localStorage (set by `finish()` below) and the
  // room-shell heartbeat reads from there on every tick — so the
  // first heartbeat AFTER the name gate puts the viewer in the
  // participants list.

  const advance = (e?: React.FormEvent) => {
    e?.preventDefault();
    const cleanName = draftName.trim().slice(0, 40);
    if (!cleanName) return;
    writeLang(lang);
    setStep(2);
  };

  // After step 2 we commit the identity AND optimistically jump to
  // step 3 in the same render so the drawer doesn't briefly close
  // (the moment between "name+avatar set → open computes false" and
  // "step=3 → open computes true" was animating the sheet shut and
  // straight back open). The async push-state check runs after; if
  // push is already on or unreachable, pushOnboardComplete flips on
  // and the sheet closes cleanly without ever rendering step 3.
  const finish = async () => {
    const cleanName = draftName.trim().slice(0, 40);
    if (!cleanName || !draftAvatar) return;
    localStorage.setItem(NAME_KEY, cleanName);
    localStorage.setItem(AVATAR_KEY, draftAvatar);
    writeLang(lang);
    window.dispatchEvent(new Event("uzk:avatar-change"));
    // Batched: name + avatar + step all flip in one render, so `open`
    // stays true through the transition.
    setName(cleanName);
    setAvatar(draftAvatar);
    setStep(3);

    if (!isSupported()) {
      setPushOnboardComplete(true);
      return;
    }
    const session = ensureSessionId();
    try {
      const state = await getState(roomCode, session);
      if (state.kind === "on" || state.kind === "blocked") {
        setPushOnboardComplete(true);
      }
    } catch {
      /* leave step 3 visible; user can skip from there */
    }
  };

  const enableNotifications = async () => {
    const session = ensureSessionId();
    const storedName = localStorage.getItem(NAME_KEY) ?? "";
    const state = await getState(roomCode, session);
    if (state.kind !== "off" || !state.vapidKey) {
      setPushOnboardComplete(true);
      return;
    }
    // Best-effort; if the user denies the OS prompt the call resolves
    // false and we close the gate anyway. The Settings drawer has a
    // recovery path with the same help copy.
    await subscribe(
      roomCode,
      session,
      storedName,
      { ...ONBOARD_PREFS },
      state.vapidKey,
      lang,
    );
    setPushOnboardComplete(true);
  };

  const skipNotifications = () => setPushOnboardComplete(true);

  if (!hydrated) return null;

  // Step 3 only appears once name + avatar are committed. After the
  // user finishes the push prompt (enable OR skip) the gate closes.
  const open = !name || !avatar || (step === 3 && !pushOnboardComplete);

  return (
    <>
      {children}
      <BottomSheet
        open={open}
        onClose={() => {
          /* not dismissible without submit */
        }}
        dismissible={false}
        trailing={<StepDots current={step} total={3} />}
        title={
          step === 1
            ? t(lang, "welcome")
            : step === 2
              ? t(lang, "pick_avatar")
              : t(lang, "notif_gate_title")
        }
        sub={
          step === 1
            ? t(lang, "name_prompt")
            : step === 3
              ? t(lang, "notif_gate_sub")
              : undefined
        }
        footer={
          // On step 2 the picked-artist card lives in the (fixed) footer
          // so it stays glued above the buttons. Step dots used to live
          // here too, absolutely centred; they're now in the header's
          // top-right slot (where an X would be) so the footer can be
          // a clean Back / Next pair.
          <div className="w-full flex flex-col gap-3">
            {step === 2 && <SelectedAvatarCard avatarId={draftAvatar} />}
            <div className="flex items-center gap-3 w-full">
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
              ) : step === 3 ? (
                // "Maybe later" sits on the LEFT (where Back would be
                // on step 2). Plain text button — Button ghost variant
                // was inheriting an accent hover that read red in the
                // dark theme. Skipping a notif prompt isn't a
                // destructive action, so it shouldn't look like one.
                <button
                  type="button"
                  onClick={skipNotifications}
                  className="shrink-0 px-2 h-9 text-sm font-display text-white/55 hover:text-white/85 transition"
                >
                  {t(lang, "notif_gate_skip")}
                </button>
              ) : (
                <span className="w-9 shrink-0" aria-hidden />
              )}
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
              ) : step === 2 ? (
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
              ) : (
                // Step 3 right-slot: just the primary CTA. "Maybe
                // later" sits on the left (above). iOS not-PWA users
                // see install hints inline and ONLY get the left
                // skip button — the right slot stays empty because
                // "Turn on" can't actually grant permission outside
                // an installed PWA.
                platform !== "ios-safari" || isInstalledPwa() ? (
                  <Button
                    type="button"
                    onClick={enableNotifications}
                    className="font-display rounded-2xl
                               bg-white text-dark-blue hover:bg-dark-blue-50"
                  >
                    {t(lang, "push_cta_enable")}
                  </Button>
                ) : null
              )}
            </div>
          </div>
        }
      >
        {/* Step bodies crossfade between transitions so the swap from
            name → avatar → notifications doesn't snap. AnimatePresence
            mode="wait" holds the next body until the previous one has
            faded out. Height of the sheet itself still reflows
            naturally because BottomSheet hugs content. */}
        {/* Wrapper carries `layout` so the BottomSheet's height
            animates between step-1's compact form and step-2's
            tall avatar grid (and step-3's notif card) instead of
            snapping. AnimatePresence still handles the per-step
            crossfade; the layout transition smooths the height
            change UNDER the crossfade so the sheet eases up/down
            in one motion. Same easing curve as the in/out for a
            consistent feel. */}
        <motion.div
          layout
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
        <AnimatePresence mode="wait" initial={false}>
        {step === 1 ? (
          // Compact — sheet auto-sizes to content. No min-h.
          <motion.form
            key="step-1"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
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
                <p className="text-xs text-flamingo/90 text-center text-balance leading-snug px-1">
                  {t(lang, "name_taken_hint")}
                </p>
              )}
            </div>
            {/* Language pill — separate from `lang` via `pillSide`
                state. flushSync forces the pill move to commit to
                the DOM BEFORE startViewTransition snapshots, so the
                snapshot captures the pill already at the new side
                and the crossfade only animates the surrounding
                strings (welcome heading, name input placeholder,
                etc). Without flushSync React batches both state
                changes into one commit, the snapshot grabs the
                OLD pill, and the root crossfade drags it along. */}
            <div className="relative flex items-center justify-center gap-1 rounded-full bg-black/30 p-1 self-center">
              <span
                aria-hidden
                className="absolute top-1 bottom-1 rounded-full bg-white pointer-events-none transition-[left] duration-0"
                style={{
                  width: "calc(50% - 0.25rem)",
                  left: pillSide === LANGUAGES[0] ? "0.25rem" : "50%",
                }}
              />
              {LANGUAGES.map((code) => {
                const active = pillSide === code;
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => {
                      flushSync(() => {
                        setPillSide(code);
                      });
                      withLangTransition(() => setLang(code));
                    }}
                    className={`relative z-10 px-5 py-2 rounded-full text-sm font-display transition-colors ${
                      active ? "text-dark-blue" : "text-white/60 hover:text-white"
                    }`}
                  >
                    {LANGUAGE_NAMES[code]}
                  </button>
                );
              })}
            </div>
          </motion.form>
        ) : step === 2 ? (
          // Step 2 expands the sheet; the grid scrolls inside the
          // existing overflow container. The picked-artist card sits in
          // the footer (above), not inline here.
          <motion.div
            key="step-2"
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col gap-3 min-h-[60dvh]"
          >
            <AvatarPicker value={draftAvatar} onChange={setDraftAvatar} />
          </motion.div>
        ) : (
          // Step 3: the friendly nudge to enable notifications. Big
          // ringing Fluent bell sits on top of a Netflix-intro-style
          // matrix of avatar photos scrolling diagonally behind, with
          // a vignette so the bell stays the focus. Drawer height
          // bumped to min-h-[50dvh] so the matrix has room to read
          // as ambient depth instead of a thin strip.
          <motion.div
            key="step-3"
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="relative flex flex-col items-center justify-center gap-4 min-h-[52dvh] -mx-5 px-5"
          >
            <AvatarMatrixBg />
            <span className="ringing-bell relative">
              <FluentEmoji glyph="🔔" size={120} ariaLabel="bell" />
            </span>
            {platform === "ios-safari" && !isInstalledPwa() && (
              // Push disabled on iOS-not-PWA. Banner sits below the
              // bell with the install steps so the user knows WHY
              // the "Turn on" CTA is gone — otherwise this step
              // would read as confusing (bell + no primary action).
              <div className="relative w-full rounded-2xl bg-flamingo/10 ring-1 ring-flamingo/25 px-4 py-3 flex flex-col gap-1.5 backdrop-blur-sm">
                <p className="font-display text-sm text-white">
                  {t(lang, "notif_gate_install_hint")}
                </p>
                <ol className="list-decimal pl-5 text-[13px] text-white/75 leading-relaxed flex flex-col gap-0.5">
                  <li>{t(lang, "push_help_ios_1")}</li>
                  <li>{t(lang, "push_help_ios_2")}</li>
                  <li>{t(lang, "push_help_ios_3")}</li>
                </ol>
              </div>
            )}
          </motion.div>
        )}
        </AnimatePresence>
        </motion.div>
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
