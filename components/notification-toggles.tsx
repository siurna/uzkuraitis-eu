"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Bell,
  BellOff,
  HelpCircle,
  MessageCircle,
  Reply,
  Radio,
  Vote,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import {
  getState,
  isSupported,
  subscribe,
  unsubscribe,
  updatePrefs,
  type PushPrefs,
  type PushState,
} from "@/lib/push-client";
import { TogglePill } from "@/components/ui/toggle-pill";
import { FluentEmoji } from "@/components/fluent-emoji";
import { useRoomLive } from "@/components/room-shell";
import { NAME_KEY, SESSION_KEY } from "@/lib/use-identity";
import { t } from "@/lib/i18n";
import { useLang } from "@/lib/i18n-client";

// Sensible defaults: notify on things the second-screen viewer needs to
// know about while they're in the kitchen or next room. now-playing ON
// is the whole reason this app exists (you want a ping each time the
// next country takes the stage); replies + voting state + results
// landing are all "your turn / hot moment" pings. chatAll stays OFF
// because at 50 viewers it'd vibrate the phone every few seconds.
const DEFAULT_PREFS: PushPrefs = {
  chatAll: false,
  chatReplies: true,
  nowPlaying: true,
  votingState: true,
  resultsTallied: true,
};

// ---------------------------------------------------------------------
// Platform detection. Returns one of:
//   "ios-safari" → must be installed as PWA via Add to Home Screen
//   "android"    → install via Chrome/Brave menu → Install app
//   "desktop"    → install via address-bar icon
//   "other"      → generic instructions
export function detectPlatform(): "ios-safari" | "android" | "desktop" | "other" {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  const standalone =
    typeof window !== "undefined" &&
    window.matchMedia("(display-mode: standalone)").matches;
  // Already running as PWA, nothing to install.
  if (standalone) return "other";
  if (/iPhone|iPad|iPod/.test(ua)) return "ios-safari";
  if (/Android/.test(ua)) return "android";
  if (/Macintosh|Windows|Linux/.test(ua)) return "desktop";
  return "other";
}

export function isInstalledPwa(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches;
}

// Notification preferences for the current room. Master toggle + 5
// per-category sub-toggles. When unsupported/blocked we render
// platform-specific install instructions inline.
export function NotificationToggles() {
  const { code: roomCode } = useRoomLive();
  const lang = useLang();
  const [state, setState] = useState<PushState | null>(null);
  const [pending, setPending] = useState(false);
  // Detect once on mount, same value for the lifetime of the panel.
  const platform = useMemo(() => detectPlatform(), []);
  const installedPwaNow = useMemo(() => isInstalledPwa(), []);
  // iOS users who haven't installed the PWA can't get notifications,
  // so the install steps are the headline content of this panel for
  // them. Pre-expand the help instead of hiding it behind a "How?"
  // tap so the action is one less interaction away.
  const [helpOpen, setHelpOpen] = useState(
    platform === "ios-safari" && !installedPwaNow,
  );

  const refresh = useCallback(async () => {
    const session = localStorage.getItem(SESSION_KEY);
    if (!session) {
      setState({ kind: "off", vapidKey: null });
      return;
    }
    setState(await getState(roomCode, session));
  }, [roomCode]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const enable = async () => {
    if (state?.kind !== "off" || !state.vapidKey) return;
    const session = localStorage.getItem(SESSION_KEY) ?? "";
    const name = localStorage.getItem(NAME_KEY) ?? "";
    setPending(true);
    const ok = await subscribe(roomCode, session, name, DEFAULT_PREFS, state.vapidKey, lang);
    setPending(false);
    if (!ok) {
      toast.error(t(lang, "push_denied"));
      return;
    }
    toast.success(t(lang, "push_enabled"));
    refresh();
  };

  const disable = async () => {
    const session = localStorage.getItem(SESSION_KEY) ?? "";
    setPending(true);
    await unsubscribe(roomCode, session);
    setPending(false);
    refresh();
  };

  const setPref = async (key: keyof PushPrefs, value: boolean) => {
    if (state?.kind !== "on") return;
    const next = { ...state.prefs, [key]: value };
    setState({ ...state, prefs: next });
    const session = localStorage.getItem(SESSION_KEY) ?? "";
    await updatePrefs(roomCode, session, next);
  };

  // Reserve the row's footprint while we resolve push state so the
  // settings sheet doesn't lurch when this section materialises.
  if (state === null) {
    return (
      <div className="rounded-2xl glass-surface h-[3.25rem] skeleton" />
    );
  }

  // On iOS, notifications need the PWA to be installed. On unsupported
  // browsers, no amount of UI will help — we still render the help
  // panel so the user understands why.
  const supported = isSupported();
  const installedPwa = isInstalledPwa();

  if (state.kind === "unsupported" || (platform === "ios-safari" && !installedPwa)) {
    return (
      <DisabledWithHelp
        lang={lang}
        platform={platform}
        helpOpen={helpOpen}
        setHelpOpen={setHelpOpen}
        reason="install"
      />
    );
  }
  if (state.kind === "blocked") {
    return (
      <DisabledWithHelp
        lang={lang}
        platform={platform}
        helpOpen={helpOpen}
        setHelpOpen={setHelpOpen}
        reason="blocked"
      />
    );
  }
  // Master switch row — same shape in both on/off states so it
  // reads as one consistent control. Electric cyan TogglePill
  // because this is the gate that opens ALL the sub-prefs below;
  // the per-pref pills are green (success), giving the page a
  // clear hierarchy: blue master, green sub-features.
  const masterOn = state.kind === "on";
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => (masterOn ? disable() : enable())}
        disabled={pending || (!masterOn && (!state.vapidKey || !supported))}
        className={`flex items-center justify-between rounded-2xl px-4 py-3 ring-1 transition text-left
                    ${masterOn
                      ? "bg-[oklch(72%_0.18_225_/_0.18)] ring-[oklch(72%_0.18_225_/_0.5)] hover:bg-[oklch(72%_0.18_225_/_0.24)]"
                      : "bg-white/5 ring-white/10 hover:bg-white/10"}
                    disabled:opacity-40`}
      >
        <span className="flex items-center gap-2 text-sm flex-wrap">
          <Bell
            className={`h-4 w-4 ${masterOn ? "text-[oklch(82%_0.16_225)]" : "text-white/65"}`}
            fill={masterOn ? "currentColor" : "none"}
          />
          <span className="font-display">
            {masterOn ? t(lang, "push_on") : t(lang, "push_enable")}
          </span>
          {platform === "ios-safari" && installedPwaNow && masterOn && (
            <span className="text-[10px] uppercase tracking-[0.18em] font-display rounded-full bg-success/20 ring-1 ring-success/45 text-success px-2 h-5 inline-flex items-center">
              iOS PWA
            </span>
          )}
        </span>
        <TogglePill on={masterOn} accent="electric" />
      </button>
      {masterOn && state.kind === "on" && (
        <div className="flex flex-col gap-2">
          <PrefRow icon={MessageCircle} label={t(lang, "push_chat_all")}        sub={t(lang, "push_chat_all_sub")}        value={!!state.prefs.chatAll}        onChange={(v) => setPref("chatAll", v)} />
          <PrefRow icon={Reply}         label={t(lang, "push_chat_replies")}    sub={t(lang, "push_chat_replies_sub")}    value={!!state.prefs.chatReplies}    onChange={(v) => setPref("chatReplies", v)} />
          <PrefRow icon={Radio}         label={t(lang, "push_now_playing")}     sub={t(lang, "push_now_playing_sub")}     value={!!state.prefs.nowPlaying}     onChange={(v) => setPref("nowPlaying", v)} />
          <PrefRow icon={Vote}          label={t(lang, "push_voting_state")}    sub={t(lang, "push_voting_state_sub")}    value={!!state.prefs.votingState}    onChange={(v) => setPref("votingState", v)} />
          <PrefRow icon={Trophy}        label={t(lang, "push_results_tallied")} sub={t(lang, "push_results_tallied_sub")} value={!!state.prefs.resultsTallied} onChange={(v) => setPref("resultsTallied", v)} />
          {/* The "Išjungti" link used to live here as a redundant
              opt-out. Toggling the master switch above already turns
              everything off; no need for a second knob below the
              prefs. */}
        </div>
      )}
    </div>
  );
}

function DisabledWithHelp({
  lang,
  platform,
  helpOpen,
  setHelpOpen,
  reason,
}: {
  lang: "en" | "lt";
  platform: ReturnType<typeof detectPlatform>;
  helpOpen: boolean;
  setHelpOpen: (v: boolean) => void;
  reason: "install" | "blocked";
}) {
  const steps = installSteps(lang, platform, reason);
  // When the OS has actively blocked permission, hiding the guide
  // behind a "How?" expander is friction the user doesn't need — the
  // only thing they CAN do is open their browser settings, so we
  // surface the steps straight away. The "install required" case
  // stays collapsible (it's softer guidance for users who haven't
  // tried to enable yet).
  if (reason === "blocked") {
    return (
      <div className="flex flex-col gap-2">
        <div
          className="w-full flex items-center gap-2 rounded-2xl px-4 py-3
                     bg-white/[0.04] ring-1 ring-white/10 text-sm text-white/70"
        >
          <BellOff className="h-4 w-4 text-dark-blue-200" />
          {t(lang, "push_blocked")}
        </div>
        <div className="rounded-2xl bg-flamingo/8 ring-1 ring-flamingo/20 px-4 py-3 text-sm text-white/85 leading-relaxed flex flex-col gap-2">
          <p className="font-display">{steps.title}</p>
          <ol className="list-decimal pl-5 flex flex-col gap-1 text-white/75">
            {steps.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setHelpOpen(!helpOpen)}
        // Row layout: bell on the left, the install text takes the
        // middle (flex-1, text-left) so it reads as a normal label
        // anchored to the icon — not floating in the centre between
        // two pushed-apart spans. The trailing "How" chip is only
        // surfaced when the help is COLLAPSED; once expanded the
        // chip is redundant (you can already see the steps and the
        // whole row stays tappable to collapse).
        className="w-full flex items-center gap-2 rounded-2xl px-4 py-3
                   bg-white/[0.04] ring-1 ring-white/10 hover:bg-white/[0.07] transition text-sm text-left"
      >
        <BellOff className="h-4 w-4 text-dark-blue-200 shrink-0" />
        <span className="flex-1 min-w-0 text-white/70">
          {t(lang, "push_install_required")}
        </span>
        {!helpOpen && (
          <span className="shrink-0 flex items-center gap-1.5 text-xs text-flamingo">
            <HelpCircle className="h-3.5 w-3.5" />
            {t(lang, "push_how")}
          </span>
        )}
      </button>
      {/* Animate opacity + a small y-offset instead of height, so the
          flamingo `ring-1` doesn't get clipped by the wrapper's
          `overflow: hidden` during the open / close tween (per
          CLAUDE.md's "overflow: hidden on a motion.div clips outset
          rings" note). Flex parent absorbs the natural height of the
          help card immediately; the slight slide just sells the
          appearance. */}
      <AnimatePresence>
        {helpOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            <div className="rounded-2xl bg-flamingo/8 ring-1 ring-flamingo/20 px-4 py-3 text-sm text-white/85 leading-relaxed flex flex-col gap-2">
              <p className="font-display">{steps.title}</p>
              <ol className="list-decimal pl-5 flex flex-col gap-1 text-white/75">
                {steps.steps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function installSteps(
  lang: "en" | "lt",
  platform: ReturnType<typeof detectPlatform>,
  reason: "install" | "blocked",
): { title: string; steps: string[] } {
  if (reason === "blocked") {
    return {
      title: t(lang, "push_help_blocked_title"),
      steps: [
        t(lang, "push_help_blocked_1"),
        t(lang, "push_help_blocked_2"),
        t(lang, "push_help_blocked_3"),
      ],
    };
  }
  if (platform === "ios-safari") {
    return {
      title: t(lang, "push_help_ios_title"),
      steps: [
        t(lang, "push_help_ios_1"),
        t(lang, "push_help_ios_2"),
        t(lang, "push_help_ios_3"),
        t(lang, "push_help_ios_4"),
      ],
    };
  }
  if (platform === "android") {
    return {
      title: t(lang, "push_help_android_title"),
      steps: [
        t(lang, "push_help_android_1"),
        t(lang, "push_help_android_2"),
        t(lang, "push_help_android_3"),
      ],
    };
  }
  if (platform === "desktop") {
    return {
      title: t(lang, "push_help_desktop_title"),
      steps: [
        t(lang, "push_help_desktop_1"),
        t(lang, "push_help_desktop_2"),
      ],
    };
  }
  return {
    title: t(lang, "push_help_other_title"),
    steps: [t(lang, "push_help_other_1")],
  };
}

function PrefRow({
  icon: Icon,
  label,
  sub,
  value,
  onChange,
}: {
  icon: LucideIcon;
  label: string;
  sub?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      aria-pressed={value}
      className="flex items-center gap-3 rounded-2xl px-3 py-2.5
                 glass-surface hover:bg-white/[0.07] transition text-left"
    >
      {/* Icon tile — gray when the pref is off, green when on.
          Mirrors the settings-modal helper rows so the entire
          notifications drawer reads as one visual family. */}
      <span
        className={`shrink-0 grid place-items-center h-9 w-9 uzk-icon-squircle transition
                    ${value
                      ? "bg-success/20 ring-1 ring-success/45 text-success"
                      : "bg-white/8 ring-1 ring-white/12 text-white/55"}`}
      >
        {/* Outline lucide — matches the broadcasts-drawer rows;
            filled variants read as solid blobs against the tint. */}
        <Icon className="h-4 w-4" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block font-display text-sm text-white text-balance">{label}</span>
        {sub && (
          <span className="block text-xs text-white/55 leading-snug mt-0.5 text-balance">
            {sub}
          </span>
        )}
      </span>
      <TogglePill on={value} />
    </button>
  );
}

// Tiny helper hook + component for the home-tab CTA so it can opt into
// push without users hunting through settings.
export function useNotificationCta(): {
  shouldShow: boolean;
  enable: () => Promise<void>;
} {
  const { code } = useRoomLive();
  const lang = useLang();
  const [state, setState] = useState<PushState | null>(null);

  const refresh = useCallback(async () => {
    const session = localStorage.getItem(SESSION_KEY);
    if (!session) {
      setState({ kind: "off", vapidKey: null });
      return;
    }
    setState(await getState(code, session));
  }, [code]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const enable = async () => {
    if (state?.kind !== "off" || !state.vapidKey) return;
    const session = localStorage.getItem(SESSION_KEY) ?? "";
    const name = localStorage.getItem(NAME_KEY) ?? "";
    const ok = await subscribe(code, session, name, DEFAULT_PREFS, state.vapidKey, lang);
    if (!ok) {
      toast.error(t(lang, "push_denied"));
      return;
    }
    toast.success(t(lang, "push_enabled"));
    refresh();
  };

  const shouldShow =
    state?.kind === "off" &&
    isSupported() &&
    !!state.vapidKey &&
    (typeof window === "undefined" ||
      !/iPhone|iPad|iPod/.test(navigator.userAgent) ||
      isInstalledPwa());

  return { shouldShow, enable };
}

export function NotificationsCta() {
  const lang = useLang();
  const { shouldShow, enable } = useNotificationCta();

  if (!shouldShow) return null;

  // A proper colour-fill banner in the Home stack — teal→blue, with a
  // ring of bell glyphs bleeding off the right, copy on the left, an
  // "enable" CTA. Same shape language as the Vote / Bingo / Bonus
  // banners. No dismiss — it self-hides the moment push is enabled.
  //
  // The outer container (max-width / centre / px) lives here so that
  // when `shouldShow` flips false, the component returns plain null
  // and the parent home stack's `gap-3` collapses cleanly without a
  // phantom wrapper.
  return (
    <div className="container mx-auto max-w-3xl px-4">
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 360, damping: 32 }}
      className="relative block w-full overflow-hidden rounded-3xl"
      style={{ background: "linear-gradient(135deg, #00b3a4 0%, #0f7fb5 52%, #2360c8 100%)" }}
    >
      {/* artwork — a clutch of bell glyphs, off the right edge.
          Routed through `<FluentEmoji>` so the 3D PNGs render
          everywhere instead of the OS-native bell, which on macOS
          / Windows looks like a flat outline that fights the
          gradient backdrop. */}
      <div className="pointer-events-none absolute inset-y-0 -right-3 flex items-center" aria-hidden>
        <span className="flex items-end gap-1 pr-6 -rotate-[6deg] opacity-90 drop-shadow">
          <FluentEmoji glyph="🔕" size={36} />
          <FluentEmoji glyph="🔔" size={56} />
          <FluentEmoji glyph="🔔" size={28} />
        </span>
      </div>
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "linear-gradient(95deg, rgba(8,9,28,0.46) 0%, rgba(8,9,28,0.2) 38%, transparent 64%)" }}
      />
      <div className="relative flex flex-col justify-center gap-1 pl-5 pr-[34%] py-6">
        <p className="text-[10px] uppercase tracking-[0.3em] font-display leading-tight text-white/75 flex items-center gap-1.5">
          <Bell className="h-3 w-3" />
          {t(lang, "push_off")}
        </p>
        <p className="font-display text-xl text-white leading-tight text-balance drop-shadow-sm">{t(lang, "push_cta_title")}</p>
        <p className="text-sm text-white/70 leading-snug text-balance">{t(lang, "push_cta_sub")}</p>
        <span className="mt-1.5">
          <button
            type="button"
            onClick={enable}
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 h-8 font-display text-xs text-dark-blue hover:bg-dark-blue-50 transition"
          >
            <Bell className="h-3.5 w-3.5" />
            {t(lang, "push_cta_enable")}
          </button>
        </span>
      </div>
    </motion.div>
    </div>
  );
}
