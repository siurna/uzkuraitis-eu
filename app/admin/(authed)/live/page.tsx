import { db } from "@/lib/db";
import { rooms } from "@/lib/db/schema";
import { AdminLivePanel } from "@/components/admin-live-panel";

// Global live controller. The admin runs the real broadcast from here:
// flip the show status / pick who's on stage and it fans out to every
// room. The per-room magic-link page can still override individual
// rooms after the fact.
export default async function AdminLivePage() {
  const rows = await db
    .select({
      showStatus: rooms.showStatus,
      nowPlayingCode: rooms.nowPlayingCode,
      runningOrderPos: rooms.runningOrderPos,
    })
    .from(rooms);

  const mode = <T extends string | number | null>(values: T[]): T | null => {
    const counts = new Map<string, { value: T; n: number }>();
    for (const v of values) {
      const key = String(v);
      const e = counts.get(key) ?? { value: v, n: 0 };
      e.n += 1;
      counts.set(key, e);
    }
    let best: { value: T; n: number } | null = null;
    for (const e of counts.values()) if (!best || e.n > best.n) best = e;
    return best?.value ?? null;
  };

  const status =
    (mode(rows.map((r) => r.showStatus)) as
      | "not_started"
      | "in_progress"
      | "break"
      | "ended") ?? "not_started";
  const nowPlaying = mode(rows.map((r) => r.nowPlayingCode));
  const runningOrderPos = mode(rows.map((r) => r.runningOrderPos));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl gradient-text heading-rise">Live</h1>
      <p className="text-sm text-white/55 max-w-prose">
        Run the broadcast from here. The status pills set the show state
        for every room at once. While in&nbsp;progress, tap a country to
        put it on stage — every connected client across all rooms sees
        the switch + a heart swarm. {rows.length} room
        {rows.length === 1 ? "" : "s"} currently exist.
      </p>
      <div className="glass-card rounded-xl p-5 max-w-md">
        <AdminLivePanel
          initialStatus={status}
          initialNowPlaying={nowPlaying}
          initialRunningOrderPos={runningOrderPos}
        />
      </div>
    </div>
  );
}

export const dynamic = "force-dynamic";
