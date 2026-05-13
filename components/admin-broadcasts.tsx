"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Megaphone, Bell, Vote, Dices, Medal, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

type Kind = "notifications" | "vote" | "bet" | "top3" | "final";

const SHOTS: { kind: Kind; icon: LucideIcon; title: string; desc: string }[] = [
  { kind: "notifications", icon: Bell, title: "Turn on notifications", desc: "Nudge the room to enable push." },
  { kind: "vote", icon: Vote, title: "Lines are open", desc: "Tell everyone to lock their TOP 10." },
  { kind: "bet", icon: Dices, title: "Don't forget bonus bets", desc: "Reminder that bets are free points." },
  { kind: "top3", icon: Medal, title: "Room top 3 right now", desc: "Posts the live fan aggregate leaders." },
  { kind: "final", icon: Sparkles, title: "Final results", desc: "Drops the scored leaderboard podium." },
];

// Admin › Live: one-tap chat announcements fired into a chosen room.
// Each button POSTs to /api/admin/broadcast, which posts a system
// message (or the results podium) into that room's chat.
export function AdminBroadcasts({ rooms }: { rooms: { code: string; name: string }[] }) {
  const [room, setRoom] = useState(rooms[0]?.code ?? "");
  const [busy, setBusy] = useState<Kind | null>(null);

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
      if (!res.ok || !data.ok) toast.error(data.error ?? "Couldn't post that.");
      else toast.success(`Posted to ${room}.`);
    } catch {
      toast.error("Couldn't post that (network).");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="glass-card rounded-xl p-5 flex flex-col gap-5">
      <header className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-flamingo/15 ring-1 ring-flamingo/30 text-flamingo">
          <Megaphone className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-display text-xl leading-tight">Broadcasts</h2>
          <p className="text-sm text-white/45 leading-snug mt-0.5">One-tap chat announcements into a room.</p>
        </div>
      </header>

      <label className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
        <span className="text-xs uppercase tracking-[0.18em] text-white/40 font-display sm:w-20 shrink-0">Room</span>
        {rooms.length === 0 ? (
          <span className="text-sm text-white/40">No rooms yet.</span>
        ) : (
          <select
            value={room}
            onChange={(e) => setRoom(e.target.value)}
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

      <div className="flex flex-col gap-2.5">
        {SHOTS.map(({ kind, icon: Icon, title, desc }) => (
          <div key={kind} className="flex items-center gap-3 rounded-xl bg-white/[0.03] ring-1 ring-white/8 p-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/[0.06] ring-1 ring-white/10 text-white/60">
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-sm text-white/90">{title}</p>
              <p className="text-[13px] text-white/45 leading-snug mt-0.5">{desc}</p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => fire(kind)}
              disabled={busy !== null || !room}
              className="shrink-0 self-center"
            >
              {busy === kind ? "Posting…" : "Post"}
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}
