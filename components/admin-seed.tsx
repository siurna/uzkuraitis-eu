"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FlaskConical, Users, Trophy, Flame, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminRoomPicker } from "@/components/admin-room-picker";

type Mode = "voters" | "highlights" | "results" | "reroll";

// Admin › Settings: a tidy dev-seed panel — demo voters, random official
// results + facts, and reaction-heavy "highlights" — so the leaderboard
// and Home widgets have something to chew on without a real crowd.
export function AdminSeed({ rooms }: { rooms: { code: string; name: string }[] }) {
  const [room, setRoom] = useState(rooms[0]?.code ?? "");
  const [voterN, setVoterN] = useState(8);
  const [busy, setBusy] = useState<Mode | null>(null);

  const run = async (mode: Mode, opts: { count?: number; needsRoom?: boolean } = {}) => {
    if (opts.needsRoom && !room) {
      toast.error("Pick a room first.");
      return;
    }
    setBusy(mode);
    try {
      const res = await fetch("/api/admin/seed", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode, ...(opts.needsRoom ? { room } : {}), ...(opts.count ? { count: opts.count } : {}) }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        created?: number;
        placed?: number;
        rerolled?: number;
        error?: string;
      };
      if (!res.ok) {
        toast.error(data.error ?? "Seed failed.");
        return;
      }
      toast.success(
        mode === "voters"
          ? `Seeded ${data.created ?? voterN} demo voters into ${room}.`
          : mode === "results"
            ? `Seeded ${data.placed ?? "all"} final placements + facts (global).`
            : mode === "reroll"
              ? `Re-rolled ${data.rerolled ?? 0} ballot${data.rerolled === 1 ? "" : "s"} in ${room}.`
              : `Posted ${data.created ?? 3} highlight messages into ${room}.`,
      );
    } catch {
      toast.error("Seed failed (network).");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="glass-card rounded-2xl p-5 sm:p-6 flex flex-col gap-5">
      <header className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-flamingo/15 ring-1 ring-flamingo/30 text-flamingo">
          <FlaskConical className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-display text-xl leading-tight">Seed data</h2>
          <p className="text-sm text-white/45 leading-snug mt-0.5">Dev only. Fills a room (or the whole show) with throwaway data. There's no undo.</p>
        </div>
      </header>

      {/* room scope — used by the per-room actions below. Drawer
          trigger sits on the right so the row reads as "scope: pick
          room"; matches the room picker on /admin/live. */}
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs uppercase tracking-[0.18em] text-white/40 font-display">Room</span>
        <AdminRoomPicker
          rooms={rooms}
          value={room}
          onChange={setRoom}
          className="min-w-[12rem]"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <SeedCard
          icon={<Users className="h-4 w-4" />}
          title="Demo voters"
          desc={
            <span className="inline-flex items-center gap-1.5">
              <Input
                type="number"
                min={1}
                max={60}
                value={voterN}
                onChange={(e) => setVoterN(Math.max(1, Math.min(60, Number(e.target.value) || 1)))}
                className="h-7 w-14 px-2 text-center tabular-nums"
                aria-label="number of demo voters"
              />
              users with random ballots, bets &amp; a home guess
            </span>
          }
          busy={busy === "voters"}
          onClick={() => run("voters", { count: voterN, needsRoom: true })}
        />
        <SeedCard
          icon={<Shuffle className="h-4 w-4" />}
          title="Re-roll ballots"
          desc="Re-randomize the TOP 10 &amp; bonus bets of everyone already in this room — no new voters"
          busy={busy === "reroll"}
          onClick={() => run("reroll", { needsRoom: true })}
        />
        <SeedCard
          icon={<Trophy className="h-4 w-4" />}
          title="Results &amp; facts"
          desc="Random final placements + jury/televote winners, nul-points, host, solo, LT total — installation-wide"
          busy={busy === "results"}
          onClick={() => run("results")}
        />
        <SeedCard
          icon={<Flame className="h-4 w-4" />}
          title="Highlights"
          desc="A few reaction-heavy chat messages, tagged with whoever's on stage"
          busy={busy === "highlights"}
          onClick={() => run("highlights", { count: 3, needsRoom: true })}
        />
      </div>
    </section>
  );
}

function SeedCard({
  icon,
  title,
  desc,
  busy,
  onClick,
}: {
  icon: React.ReactNode;
  title: React.ReactNode;
  desc: React.ReactNode;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-white/[0.03] ring-1 ring-white/8 p-3.5">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/[0.06] ring-1 ring-white/10 text-white/60">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-sm text-white/90">{title}</p>
        <p className="text-[13px] text-white/45 leading-snug mt-0.5">{desc}</p>
      </div>
      <Button type="button" size="sm" onClick={onClick} disabled={busy} className="shrink-0 self-center">
        {busy ? "Seeding…" : "Seed"}
      </Button>
    </div>
  );
}

