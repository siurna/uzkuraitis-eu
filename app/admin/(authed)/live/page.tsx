import { desc, gt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { rooms, voters } from "@/lib/db/schema";
import { AdminLivePanel } from "@/components/admin-live-panel";
import { AdminLiveRoomColumn } from "@/components/admin-live-room-column";
import { AdminPageTitle } from "@/components/admin-page-title";

// Global live controller. The admin runs the real broadcast from here:
// flip the show status / pick who's on stage and it fans out to every
// room.
export default async function AdminLivePage() {
  // Per-room ACTIVE-NOW count for the picker badge. "Active" =
  // session pinged the heartbeat endpoint within the last 120s
  // (room-shell pings every 60s + on visibilitychange, so a 120s
  // window covers one missed beat without false-positive-ing a
  // closed tab). The lifetime COUNT() version this replaced over-
  // counted hard: anyone who ever joined still showed up forever.
  const ACTIVE_WINDOW_MS = 120_000;
  const cutoff = new Date(Date.now() - ACTIVE_WINDOW_MS);
  const [rows, activeRows] = await Promise.all([
    db
      .select({
        code: rooms.code,
        name: rooms.name,
        showStatus: rooms.showStatus,
        nowPlayingCode: rooms.nowPlayingCode,
        votingEnabled: rooms.votingEnabled,
        tallyEnabled: rooms.tallyEnabled,
        triviaEnabled: rooms.triviaEnabled,
        triviaMaxAnswerers: rooms.triviaMaxAnswerers,
        highlightThreshold: rooms.highlightThreshold,
        lastActiveAt: rooms.lastActiveAt,
        id: rooms.id,
      })
      .from(rooms)
      .orderBy(desc(rooms.lastActiveAt)),
    db
      .select({
        roomId: voters.roomId,
        n: sql<number>`COUNT(*)::int`,
      })
      .from(voters)
      .where(gt(voters.updatedAt, cutoff))
      .groupBy(voters.roomId),
  ]);
  const activeByRoom = new Map(activeRows.map((r) => [r.roomId, r.n]));

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
      <AdminPageTitle>Live</AdminPageTitle>
      {/* Two-column cockpit on desktop: each column lives in its own
          glass card so the busy mass of controls reads as two grouped
          surfaces instead of a single wall. On mobile they stack
          full-width — the cards collapse to bare sections. */}
      <div className="grid gap-6 lg:grid-cols-2 items-start">
        <section className="glass-card rounded-2xl p-5">
          <AdminLivePanel initialStatus={status} initialNowPlaying={nowPlaying} />
        </section>
        <section className="glass-card rounded-2xl p-5">
          <AdminLiveRoomColumn
            rooms={rows.map((r) => ({
              code: r.code,
              name: r.name,
              votingEnabled: r.votingEnabled,
              tallyEnabled: r.tallyEnabled,
              triviaEnabled: r.triviaEnabled,
              triviaMaxAnswerers: r.triviaMaxAnswerers,
              highlightThreshold: r.highlightThreshold,
              activeCount: activeByRoom.get(r.id) ?? 0,
            }))}
          />
        </section>
      </div>
    </div>
  );
}

export const dynamic = "force-dynamic";
