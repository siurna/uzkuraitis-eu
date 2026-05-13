"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Megaphone, Bell, Vote, Dices, Medal, Sparkles, Loader2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Kind = "notifications" | "vote" | "bet" | "top3" | "final";

const ROOM_STORAGE_KEY = "uzk_admin_broadcast_room";
// Local "when did I last fire X in room Y" log. Persisting in localStorage
// is good enough — it's a reference for the admin who's running the show,
// not a global audit trail.
const FIRED_KEY = (room: string, kind: Kind) => `uzk_broadcast_${room}_${kind}`;

const SHOTS: {
  kind: Kind;
  icon: LucideIcon;
  title: string;
  desc: string;
  fill: string;
}[] = [
  {
    kind: "notifications",
    icon: Bell,
    title: "Turn on notifications",
    desc: "Nudge the room to enable push.",
    fill: "linear-gradient(135deg, #00b3a4 0%, #0f7fb5 52%, #2360c8 100%)",
  },
  {
    kind: "vote",
    icon: Vote,
    title: "Lines are open",
    desc: "Tell everyone to lock their TOP 10.",
    fill: "linear-gradient(135deg, #0040ee 0%, #6020c6 55%, #7d1f9a 100%)",
  },
  {
    kind: "bet",
    icon: Dices,
    title: "Don't forget bonus bets",
    desc: "Reminder that bets are free points.",
    fill: "linear-gradient(135deg, #bc1475 0%, #f10d59 100%)",
  },
  {
    kind: "top3",
    icon: Medal,
    title: "Room top 3 right now",
    desc: "Posts the live fan aggregate leaders.",
    fill: "linear-gradient(135deg, #f5a302 0%, #d61570 60%, #4c0a54 100%)",
  },
  {
    kind: "final",
    icon: Sparkles,
    title: "Final results",
    desc: "Drops the scored leaderboard podium.",
    fill: "linear-gradient(135deg, #5a22a9 0%, #9b1690 50%, #c91475 100%)",
  },
];

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.round(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

// Admin › Live: each broadcast is its own big tappable widget — same
// shape language as the now-playing hero. Tap the card to fire it. Shows
// when this shot was last sent into the chosen room (local log).
export function AdminBroadcasts({ rooms }: { rooms: { code: string; name: string }[] }) {
  const [room, setRoom] = useState(rooms[0]?.code ?? "");
  const [busy, setBusy] = useState<Kind | null>(null);
  const [lastFired, setLastFired] = useState<Partial<Record<Kind, string>>>({});

  // Remember the last room the host broadcast to across reloads, and
  // pull each shot's last-fired stamp for this room.
  useEffect(() => {
    const saved = localStorage.getItem(ROOM_STORAGE_KEY);
    if (saved && rooms.some((r) => r.code === saved)) setRoom(saved);
  }, [rooms]);

  useEffect(() => {
    if (!room) {
      setLastFired({});
      return;
    }
    const next: Partial<Record<Kind, string>> = {};
    for (const { kind } of SHOTS) {
      const v = localStorage.getItem(FIRED_KEY(room, kind));
      if (v) next[kind] = v;
    }
    setLastFired(next);
  }, [room]);

  const chooseRoom = (code: string) => {
    setRoom(code);
    try {
      localStorage.setItem(ROOM_STORAGE_KEY, code);
    } catch {
      /* ignore */
    }
  };

  const fire = async (kind: Kind) => {
    if (!room) {
      toast.error("Pick a room first.");
      return;
    }
    setBusy(kind);
    try {
      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ room, kind }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        toast.error(data.error ?? "Couldn't post that.");
      } else {
        toast.success(`Posted to ${room}.`);
        const now = new Date().toISOString();
        try {
          localStorage.setItem(FIRED_KEY(room, kind), now);
        } catch {
          /* ignore */
        }
        setLastFired((prev) => ({ ...prev, [kind]: now }));
      }
    } catch {
      toast.error("Couldn't post that (network).");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="flex flex-col gap-4">
      <header className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-flamingo/15 ring-1 ring-flamingo/30 text-flamingo">
          <Megaphone className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-display text-xl leading-tight">Broadcasts</h2>
          <p className="text-sm text-white/45 leading-snug mt-0.5">
            One-tap chat announcements into a room.
          </p>
        </div>
      </header>

      <label className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
        <span className="text-xs uppercase tracking-[0.18em] text-white/40 font-display sm:w-20 shrink-0">
          Room
        </span>
        {rooms.length === 0 ? (
          <span className="text-sm text-white/40">No rooms yet.</span>
        ) : (
          <select
            value={room}
            onChange={(e) => chooseRoom(e.target.value)}
            className="h-10 rounded-lg bg-black/30 border border-white/15 px-3 text-sm text-white
                       focus:border-flamingo focus:outline-none focus:ring-2 focus:ring-flamingo/40 w-full"
          >
            {rooms.map((r) => (
              <option key={r.code} value={r.code} className="bg-dark-blue-900">
                {r.name} ({r.code})
              </option>
            ))}
          </select>
        )}
      </label>

      <div className="flex flex-col gap-3">
        {SHOTS.map(({ kind, icon: Icon, title, desc, fill }) => {
          const last = lastFired[kind];
          const sending = busy === kind;
          return (
            <button
              key={kind}
              type="button"
              onClick={() => fire(kind)}
              disabled={busy !== null || !room}
              style={{ background: fill }}
              className="relative block w-full overflow-hidden rounded-3xl text-left
                         transition disabled:opacity-60 disabled:cursor-not-allowed
                         active:scale-[0.99] transform-gpu"
            >
              {/* Icon artwork, off the right edge — matches the now-playing
                  / home-banner shape language. */}
              <div className="pointer-events-none absolute inset-y-0 -right-3 flex items-center" aria-hidden>
                <Icon className="h-24 w-24 text-white/15 -rotate-[8deg]" strokeWidth={1.2} />
              </div>
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    "linear-gradient(95deg, rgba(8,9,28,0.5) 0%, rgba(8,9,28,0.22) 38%, transparent 64%)",
                }}
              />
              <div className="relative flex flex-col justify-center gap-1 pl-5 pr-[34%] py-5 min-h-[6.75rem]">
                <p className="text-[10px] uppercase tracking-[0.3em] font-display leading-tight text-white/80 flex items-center gap-1.5">
                  <Icon className="h-3 w-3" />
                  Broadcast
                </p>
                <p className="font-display text-xl text-white leading-tight drop-shadow-sm">{title}</p>
                <p className="text-sm text-white/75 leading-snug">{desc}</p>
                <p className="text-[11px] text-white/55 mt-1 inline-flex items-center gap-1.5">
                  {sending ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Posting…
                    </>
                  ) : last ? (
                    <>Last fired {timeAgo(last)}</>
                  ) : (
                    <>Not fired yet</>
                  )}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
