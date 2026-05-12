"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Bell, BellOff, HelpCircle, X } from "lucide-react";
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
import { useRoomLive } from "@/components/room-shell";
import { NAME_KEY, SESSION_KEY } from "@/lib/use-identity";
import { useLang, t } from "@/lib/i18n";

const DEFAULT_PREFS: PushPrefs = {
  chatAll: true,
  chatReplies: true,
  nowPlaying: false,
  votingState: true,
  resultsTallied: true,
};

// ---------------------------------------------------------------------
// Platform detection. Returns one of:
//   "ios-safari" → must be installed as PWA via Add to Home Screen
//   "android"    → install via Chrome/Brave menu → Install app
//   "desktop"    → install via address-bar icon
//   "other"      → generic instructions
function detectPlatform(): "ios-safari" | "android" | "desktop" | "other" {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  const standalone =
    typeof window !== "undefined" &&
    window.matchMedia("(display-mode: standalone)").matches;
  // Already running as PWA — nothing to install.
  if (standalone) return "other";
  if (/iPhone|iPad|iPod/.test(ua)) return "ios-safari";
  if (/Android/.test(ua)) return "android";
  if (/Macintosh|Windows|Linux/.test(ua)) return "desktop";
  return "other";
}

function isInstalledPwa(): boolean {
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
  const [helpOpen, setHelpOpen] = useState(false);
  // Detect once on mount — same value for the lifetime of the panel.
  const platform = useMemo(() => detectPlatform(), []);

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
    const ok = await subscribe(roomCode, session, name, DEFAULT_PREFS, state.vapidKey);
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
      <div className="rounded-2xl bg-white/[0.04] ring-1 ring-white/8 h-[3.25rem] animate-pulse" />
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
  if (state.kind === "off") {
    return (
      <button
        type="button"
        onClick={enable}
        disabled={pending || !state.vapidKey || !supported}
        className="w-full flex items-center justify-between rounded-2xl px-4 py-3
                   bg-white/5 ring-1 ring-white/10 hover:bg-white/10 transition
                   text-sm disabled:opacity-40"
      >
        <span className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-dark-blue-200" />
          {t(lang, "push_enable")}
        </span>
        <span className="text-xs text-white/40">{t(lang, "push_off")}</span>
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between rounded-2xl px-4 py-3
                      bg-flamingo/10 ring-1 ring-flamingo/30">
        <span className="flex items-center gap-2 text-sm">
          <Bell className="h-4 w-4 text-flamingo" />
          {t(lang, "push_on")}
        </span>
        <button
          type="button"
          onClick={disable}
          disabled={pending}
          className="text-xs text-white/55 hover:text-white inline-flex items-center gap-1.5"
        >
          <BellOff className="h-3.5 w-3.5" />
          {t(lang, "push_disable")}
        </button>
      </div>
      <PrefRow label={t(lang, "push_chat_all")}        sub={t(lang, "push_chat_all_sub")}        value={!!state.prefs.chatAll}        onChange={(v) => setPref("chatAll", v)} />
      <PrefRow label={t(lang, "push_chat_replies")}    sub={t(lang, "push_chat_replies_sub")}    value={!!state.prefs.chatReplies}    onChange={(v) => setPref("chatReplies", v)} />
      <PrefRow label={t(lang, "push_now_playing")}     sub={t(lang, "push_now_playing_sub")}     value={!!state.prefs.nowPlaying}     onChange={(v) => setPref("nowPlaying", v)} />
      <PrefRow label={t(lang, "push_voting_state")}    sub={t(lang, "push_voting_state_sub")}    value={!!state.prefs.votingState}    onChange={(v) => setPref("votingState", v)} />
      <PrefRow label={t(lang, "push_results_tallied")} sub={t(lang, "push_results_tallied_sub")} value={!!state.prefs.resultsTallied} onChange={(v) => setPref("resultsTallied", v)} />
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
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setHelpOpen(!helpOpen)}
        className="w-full flex items-center justify-between rounded-2xl px-4 py-3
                   bg-white/[0.04] ring-1 ring-white/10 hover:bg-white/[0.07] transition text-sm"
      >
        <span className="flex items-center gap-2 text-white/70">
          <BellOff className="h-4 w-4 text-dark-blue-200" />
          {reason === "install"
            ? t(lang, "push_install_required")
            : t(lang, "push_blocked")}
        </span>
        <span className="flex items-center gap-1.5 text-xs text-flamingo">
          <HelpCircle className="h-3.5 w-3.5" />
          {t(lang, "push_how")}
        </span>
      </button>
      <AnimatePresence>
        {helpOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
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
  label,
  sub,
  value,
  onChange,
}: {
  label: string;
  sub?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="flex items-center gap-3 rounded-2xl px-4 py-3
                 bg-white/[0.04] ring-1 ring-white/8 hover:bg-white/[0.07] transition text-left"
    >
      <span className="flex-1 min-w-0">
        <span className="block text-sm text-white/90">{label}</span>
        {sub && <span className="block text-xs text-white/45 leading-snug mt-0.5">{sub}</span>}
      </span>
      <span
        className={`relative h-6 w-11 rounded-full transition shrink-0 ${
          value ? "bg-success/70" : "bg-white/10"
        }`}
        aria-hidden
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition transform ${
            value ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </span>
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
    const ok = await subscribe(code, session, name, DEFAULT_PREFS, state.vapidKey);
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
  const [dismissed, setDismissed] = useState(false);

  if (!shouldShow || dismissed) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="relative rounded-2xl bg-flamingo/10 ring-1 ring-flamingo/35 px-4 py-3
                 flex items-center gap-3"
    >
      <Bell className="h-5 w-5 text-flamingo shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-display text-sm">{t(lang, "push_cta_title")}</p>
        <p className="text-xs text-white/55 leading-snug">
          {t(lang, "push_cta_sub")}
        </p>
      </div>
      <button
        type="button"
        onClick={enable}
        className="shrink-0 px-3 h-8 rounded-full font-display text-xs
                   bg-white text-dark-blue hover:bg-dark-blue-50 transition"
      >
        {t(lang, "push_cta_enable")}
      </button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label={t(lang, "cancel")}
        className="shrink-0 text-white/40 hover:text-white transition"
      >
        <X className="h-4 w-4" />
      </button>
    </motion.div>
  );
}
