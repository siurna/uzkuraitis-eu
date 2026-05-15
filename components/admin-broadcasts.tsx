"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Megaphone, Bell, Vote, Dices, Medal, Sparkles, Loader2, Camera, BarChart3, MessageCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/utils";

type Kind = "notifications" | "vote" | "bet" | "top3" | "final" | "selfie" | "drunk_poll" | "welcome";

const ROOM_STORAGE_KEY = "uzk_admin_broadcast_room";
// Local "when did I last fire X in room Y" log. Persisting in localStorage
// is good enough — it's a reference for the admin who's running the show,
// not a global audit trail.
const FIRED_KEY = (room: string, kind: Kind) => `uzk_broadcast_${room}_${kind}`;

// Broadcasts grouped by where in the show they belong. Ordered
// within each group by the natural sequence the admin would fire
// them on the night.
type ShotGroup = "beginning" | "during" | "closers";
const GROUP_LABELS: Record<ShotGroup, string> = {
  beginning: "Beginning",
  during: "During the show",
  closers: "Closers",
};

const SHOTS: {
  kind: Kind;
  group: ShotGroup;
  icon: LucideIcon;
  title: string;
  desc: string;
}[] = [
  // ── Beginning: doors, housekeeping, opt-ins, voting open ──
  { kind: "welcome", group: "beginning", icon: MessageCircle, title: "Hello folks", desc: "Drops the housekeeping notes you wrote into chat." },
  { kind: "notifications", group: "beginning", icon: Bell, title: "Turn on notifications", desc: "Nudge the room to enable push." },
  { kind: "bet", group: "beginning", icon: Dices, title: "Don't forget bonus bets", desc: "Reminder that bets are free points." },
  { kind: "vote", group: "beginning", icon: Vote, title: "Lines are open", desc: "Tell everyone to lock their TOP 10." },
  // ── During the show: vibe checks, mid-show drama ──
  { kind: "selfie", group: "during", icon: Camera, title: "Selfie time", desc: "Prompts everyone to drop a selfie in chat." },
  { kind: "drunk_poll", group: "during", icon: BarChart3, title: "How drunk are you?", desc: "Vibe-check poll with a live tally bar." },
  { kind: "top3", group: "during", icon: Medal, title: "Room top 3 right now", desc: "Posts the live fan aggregate leaders." },
  // ── Closers: results + curtain ──
  { kind: "final", group: "closers", icon: Sparkles, title: "Final results", desc: "Drops the scored leaderboard podium." },
];

// Admin › Live: one-tap chat announcements fired into a chosen room.
// Each button POSTs to /api/admin/broadcast, which posts a system
// message (or the results podium) into that room's chat.
//
// Two usage modes:
//   - Standalone: pass `rooms`, no `room`/`onRoomChange`. The widget
//     owns its own dropdown + selection (default behaviour, kept for
//     any caller that doesn't share state).
//   - Controlled: pass `room` + `onRoomChange` + `hideRoomPicker={true}`.
//     The parent (admin-live-room-column) owns one dropdown that
//     drives broadcasts AND the voting/results toggles below.
export function AdminBroadcasts({
  rooms,
  room: roomProp,
  onRoomChange,
  hideRoomPicker = false,
}: {
  rooms: { code: string; name: string }[];
  room?: string;
  onRoomChange?: (code: string) => void;
  hideRoomPicker?: boolean;
}) {
  const [internalRoom, setInternalRoom] = useState(rooms[0]?.code ?? "");
  const room = roomProp ?? internalRoom;
  const setRoomState = onRoomChange ?? setInternalRoom;
  const [busy, setBusy] = useState<Kind | null>(null);
  const [lastFired, setLastFired] = useState<Partial<Record<Kind, string>>>({});

  // Remember the last room the host broadcast to across reloads, and
  // pull each shot's last-fired stamp for this room.
  // Only restore from storage when we own the state — controlled mode
  // gets its initial value from the parent.
  useEffect(() => {
    if (onRoomChange) return; // controlled mode: parent owns selection
    const saved = localStorage.getItem(ROOM_STORAGE_KEY);
    if (saved && rooms.some((r) => r.code === saved)) setInternalRoom(saved);
  }, [rooms, onRoomChange]);

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
    setRoomState(code);
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
        <span className="grid h-10 w-10 shrink-0 place-items-center uzk-icon-squircle bg-flamingo/15 ring-1 ring-flamingo/30 text-flamingo">
          <Megaphone className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-display text-xl leading-tight">Broadcasts</h2>
          <p className="text-sm text-white/45 leading-snug mt-0.5 text-balance">
            One-tap chat announcements into a room.
          </p>
        </div>
      </header>

      {!hideRoomPicker && (
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
      )}

      <div className="flex flex-col gap-6">
        {(Object.keys(GROUP_LABELS) as ShotGroup[]).map((group) => {
          const groupShots = SHOTS.filter((s) => s.group === group);
          if (groupShots.length === 0) return null;
          return (
            <div key={group} className="flex flex-col gap-3">
              <p className="text-[10px] uppercase tracking-[0.24em] text-white/45 font-display px-1">
                {GROUP_LABELS[group]}
              </p>
              <div className="flex flex-col gap-3">
                {groupShots.map(({ kind, icon: Icon, title, desc }) => {
                  const last = lastFired[kind];
                  const sending = busy === kind;
                  return (
                    <div
                      key={kind}
                      className="flex items-center gap-3 rounded-xl bg-white/[0.03] ring-1 ring-white/8 p-3"
                    >
                      <span className="grid h-8 w-8 shrink-0 place-items-center uzk-icon-squircle bg-white/[0.06] ring-1 ring-white/10 text-white/60">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-display text-sm text-white/90">{title}</p>
                        <p className="text-[13px] text-white/45 leading-snug mt-0.5 text-balance">{desc}</p>
                        {/* Status line: keep the "Last fired X ago"
                            text mounted regardless of the post state,
                            and append a Posting… badge separately when
                            sending. Used to swap the whole line which
                            shifted the row height on every click. */}
                        <p className="text-[11px] text-white/40 mt-0.5 inline-flex items-center gap-1.5">
                          {last ? <>Last fired {timeAgo(last)}</> : <>Not fired yet</>}
                          {sending && (
                            <span className="inline-flex items-center gap-1 text-flamingo/85">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Posting…
                            </span>
                          )}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => fire(kind)}
                        disabled={busy !== null || !room}
                        className="shrink-0 self-center w-[64px]"
                      >
                        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Post"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
