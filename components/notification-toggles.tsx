"use client";

import { useEffect, useState, useCallback } from "react";
import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import {
  getState,
  subscribe,
  unsubscribe,
  updatePrefs,
  type PushPrefs,
  type PushState,
} from "@/lib/push-client";
import { useRoomLive } from "@/components/room-shell";
import { useLang, t } from "@/lib/i18n";

// Notification preferences for the current room. Renders a list of
// toggles; the master toggle enables push delivery, each child toggle
// gates a specific event category. Best-effort UX — if push is
// unsupported or blocked, the panel renders a one-liner instead.
const NAME_KEY = "uzk_name";
const SESSION_KEY = "uzk_session";

const DEFAULT_PREFS: PushPrefs = {
  chatAll: true,
  chatReplies: true,
  nowPlaying: false,
  votingState: true,
  resultsTallied: true,
};

export function NotificationToggles() {
  const { code: roomCode } = useRoomLive();
  const lang = useLang();
  const [state, setState] = useState<PushState | null>(null);
  const [pending, setPending] = useState(false);

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

  if (state === null) return null;
  if (state.kind === "unsupported") {
    return (
      <p className="text-xs text-white/40 leading-relaxed">
        {t(lang, "push_unsupported")}
      </p>
    );
  }
  if (state.kind === "blocked") {
    return (
      <p className="text-xs text-white/40 leading-relaxed">
        {t(lang, "push_blocked")}
      </p>
    );
  }
  if (state.kind === "off") {
    return (
      <button
        type="button"
        onClick={enable}
        disabled={pending || !state.vapidKey}
        className="w-full flex items-center justify-between rounded-2xl px-4 py-3
                   bg-white/5 ring-1 ring-white/10 hover:bg-white/10 transition
                   text-sm disabled:opacity-40"
      >
        <span className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-white/70" />
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
      <PrefRow
        label={t(lang, "push_chat_all")}
        value={!!state.prefs.chatAll}
        onChange={(v) => setPref("chatAll", v)}
      />
      <PrefRow
        label={t(lang, "push_chat_replies")}
        value={!!state.prefs.chatReplies}
        onChange={(v) => setPref("chatReplies", v)}
      />
      <PrefRow
        label={t(lang, "push_now_playing")}
        value={!!state.prefs.nowPlaying}
        onChange={(v) => setPref("nowPlaying", v)}
      />
      <PrefRow
        label={t(lang, "push_voting_state")}
        value={!!state.prefs.votingState}
        onChange={(v) => setPref("votingState", v)}
      />
      <PrefRow
        label={t(lang, "push_results_tallied")}
        value={!!state.prefs.resultsTallied}
        onChange={(v) => setPref("resultsTallied", v)}
      />
    </div>
  );
}

function PrefRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="flex items-center justify-between rounded-2xl px-4 py-2.5
                 bg-white/[0.04] ring-1 ring-white/8 hover:bg-white/[0.07] transition
                 text-sm text-left"
    >
      <span className="flex-1 truncate">{label}</span>
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
