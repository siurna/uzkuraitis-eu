import { desc } from "drizzle-orm";
import { Radio } from "lucide-react";
import { db } from "@/lib/db";
import { rooms } from "@/lib/db/schema";
import { AdminLivePanel } from "@/components/admin-live-panel";
import { AdminLiveRoomColumn } from "@/components/admin-live-room-column";
import { AdminPageTitle } from "@/components/admin-page-title";

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
        {/* Right column: one room dropdown drives broadcasts +
            voting/results toggles below. Lets the host pick a room
            once and run every live action against it. */}
        <AdminLiveRoomColumn
          rooms={rows.map((r) => ({
            code: r.code,
            name: r.name,
            votingEnabled: r.votingEnabled,
            tallyEnabled: r.tallyEnabled,
          }))}
        />
      </div>
    </div>
  );
}

export const dynamic = "force-dynamic";
