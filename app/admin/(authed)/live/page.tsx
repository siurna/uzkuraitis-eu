import { desc } from "drizzle-orm";
import { Radio, Settings } from "lucide-react";
import { db } from "@/lib/db";
import { rooms } from "@/lib/db/schema";
import { AdminLivePanel } from "@/components/admin-live-panel";
import { AdminBroadcasts } from "@/components/admin-broadcasts";
import { AdminPageTitle } from "@/components/admin-page-title";
import { AdminRoomToggle } from "@/components/admin-room-toggle";
import { AdminRoomTallyToggle } from "@/components/admin-room-tally-toggle";

// Global live controller. The admin runs the real broadcast from here:
// flip the show status / pick who's on stage and it fans out to every
// room. The per-room magic-link page can still override individual rooms
// after the fact. The running-order position is derived server-side from
// the country's startlist order — no separate control.
export default async function AdminLivePage() {
  const rows = await db
    .select({
      code: rooms.code,
      name: rooms.name,
      showStatus: rooms.showStatus,
      nowPlayingCode: rooms.nowPlayingCode,
      votingEnabled: rooms.votingEnabled,
      tallyEnabled: rooms.tallyEnabled,
      lastActiveAt: rooms.lastActiveAt,
    })
    .from(rooms)
    .orderBy(desc(rooms.lastActiveAt));

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

  return (
    <div className="flex flex-col gap-6">
      <AdminPageTitle icon={Radio}>Live</AdminPageTitle>
      <div className="grid gap-8 lg:grid-cols-2 items-start">
        <AdminLivePanel initialStatus={status} initialNowPlaying={nowPlaying} />
        <AdminBroadcasts rooms={rows.map((r) => ({ code: r.code, name: r.name }))} />
      </div>

      {/* Per-room voting + reveal-results toggles. Lives below the
          broadcast widgets so the admin can flip rooms quickly during
          a live show without bouncing to /admin/rooms/[code]. */}
      {rows.length > 0 && (
        <section className="flex flex-col gap-4">
          <header className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-flamingo/15 ring-1 ring-flamingo/30 text-flamingo">
              <Settings className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-display text-xl leading-tight">Room voting + results</h2>
              <p className="text-sm text-white/45 leading-snug mt-0.5">
                Quick toggles per room. Same controls as Rooms › Settings, mirrored here for live operation.
              </p>
            </div>
          </header>
          <ul className="flex flex-col gap-3">
            {rows.map((r) => (
              <li
                key={r.code}
                className="rounded-2xl bg-white/[0.03] ring-1 ring-white/8 p-3 flex flex-col gap-2"
              >
                <div className="flex items-center gap-2">
                  <p className="font-display text-sm text-white/90 flex-1 truncate">{r.name}</p>
                  <code className="text-[10px] tracking-[0.2em] text-white/40">{r.code}</code>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex-1">
                    <AdminRoomToggle code={r.code} initialEnabled={r.votingEnabled} />
                  </div>
                  <div className="flex-1">
                    <AdminRoomTallyToggle code={r.code} initialEnabled={r.tallyEnabled} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export const dynamic = "force-dynamic";
