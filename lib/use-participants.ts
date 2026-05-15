"use client";

import { useEffect, useState } from "react";

// REST-driven participants list — the source of truth for who's in
// the room. Replaces the Supabase Realtime presence flow that kept
// getting kicked off the channel at climax (per-client 1/sec presence
// rate limit). Polls /api/rooms/[code]/participants every 20s and
// hands the result to consumers (WhosHere, name-gate's name-taken
// check, chat-panel's @-mention autocomplete).
//
// Latency vs. presence:
//   - Joiner appears in WhosHere within ~30s (heartbeat lands +
//     next poll). Presence used to show them within ~1s.
//   - Leaver disappears within ~3s thanks to the `pagehide`
//     leave-beacon (room-shell sends it via sendBeacon); without
//     the beacon they age out of the 90s active window naturally.
// For a watch-party (slow churn over 3 hours) those latencies are
// fine. The wins are: zero rate-limit risk, no channel-kick
// failure mode, and one less primitive (broadcasts only).

export type Participant = {
  sessionId: string;
  name: string;
  avatarId: string | null;
  vibe: number;
  seenAt: string | null;
  updatedAt: string;
};

const POLL_MS = 20_000;

export function useParticipants(code: string | null): Participant[] {
  const [participants, setParticipants] = useState<Participant[]>([]);

  useEffect(() => {
    if (!code) {
      setParticipants([]);
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const fetchNow = async () => {
      try {
        const res = await fetch(`/api/rooms/${code}/participants`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as { participants?: Participant[] };
        if (cancelled) return;
        if (data.participants) setParticipants(data.participants);
      } catch {
        /* network blip — keep the previous list, the next tick retries */
      }
    };

    void fetchNow();
    const start = () => {
      if (timer != null) return;
      timer = setInterval(fetchNow, POLL_MS);
    };
    const stop = () => {
      if (timer != null) {
        clearInterval(timer);
        timer = null;
      }
    };
    if (typeof document === "undefined" || document.visibilityState === "visible") {
      start();
    }
    const onVis = () => {
      if (document.visibilityState === "visible") {
        void fetchNow();
        start();
      } else {
        stop();
      }
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVis);
    }
    return () => {
      cancelled = true;
      stop();
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVis);
      }
    };
  }, [code]);

  return participants;
}
