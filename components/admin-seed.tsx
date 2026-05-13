"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Dev seeding panel (Admin › Settings): drop demo voters / highlights
// into a room so the leaderboard + Home widgets have something to show.
export function AdminSeed() {
  const [room, setRoom] = useState("");
  const [voterN, setVoterN] = useState(8);
  const hlN = 3;
  const [busy, setBusy] = useState<null | "voters" | "highlights">(null);

  const run = async (mode: "voters" | "highlights", count: number) => {
    const code = room.trim().toUpperCase();
    if (code.length !== 6) {
      toast.error("Enter a 6-character room code first.");
      return;
    }
    setBusy(mode);
    try {
      const res = await fetch("/api/admin/seed", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode, room: code, count }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; created?: number; error?: string };
      if (res.ok) {
        toast.success(
          mode === "voters"
            ? `Seeded ${data.created ?? count} demo voters into ${code}.`
            : `Posted ${data.created ?? count} highlight messages into ${code}.`,
        );
      } else {
        toast.error(data.error ?? "Seed failed.");
      }
    } catch {
      toast.error("Seed failed (network).");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="glass-card rounded-xl p-5 flex flex-col gap-4">
      <div>
        <h2 className="font-display text-xl">Seed data (dev)</h2>
        <p className="text-sm text-white/50 mt-0.5">
          Throw demo voters or reaction-heavy "highlights" into a room for testing. No undo.
        </p>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs uppercase tracking-wider text-white/45 font-display">Room code</span>
        <Input
          value={room}
          onChange={(e) => setRoom(e.target.value.toUpperCase().slice(0, 6))}
          placeholder="ABC234"
          className="h-10 w-44 uppercase tracking-[0.2em]"
        />
      </label>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-wider text-white/45 font-display"># demo voters</span>
          <Input
            type="number"
            min={1}
            max={60}
            value={voterN}
            onChange={(e) => setVoterN(Math.max(1, Math.min(60, Number(e.target.value) || 1)))}
            className="h-10 w-24"
          />
        </label>
        <Button type="button" onClick={() => run("voters", voterN)} disabled={!!busy} className="h-10">
          {busy === "voters" ? "Seeding…" : "Add demo voters"}
        </Button>
        <span className="flex-1" />
        <Button
          type="button"
          variant="secondary"
          onClick={() => run("highlights", hlN)}
          disabled={!!busy}
          className="h-10"
        >
          {busy === "highlights" ? "Posting…" : `Add ${hlN} random highlights`}
        </Button>
      </div>
    </section>
  );
}
