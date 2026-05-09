import Link from "next/link";
import { desc, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { rooms, voters } from "@/lib/db/schema";
import { AdminRoomToggle } from "@/components/admin-room-toggle";

// One-shot SQL query: every room with its vote count + last-active timestamp.
async function loadRooms() {
  return db
    .select({
      id: rooms.id,
      code: rooms.code,
      name: rooms.name,
      votingEnabled: rooms.votingEnabled,
      createdAt: rooms.createdAt,
      lastActiveAt: rooms.lastActiveAt,
      voterCount: sql<number>`(
        SELECT COUNT(*)::int FROM ${voters} v WHERE v.room_id = ${rooms.id}
      )`,
    })
    .from(rooms)
    .orderBy(desc(rooms.lastActiveAt));
}

function timeAgo(d: Date): string {
  const ms = Date.now() - d.getTime();
  const m = Math.round(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  return `${days}d ago`;
}

export default async function AdminRoomsPage() {
  const list = await loadRooms();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl gradient-text">Rooms</h1>
          <p className="text-sm text-white/50 mt-1">
            All party rooms across this Eurovision installation.
          </p>
        </div>
        <span className="px-3 py-1 rounded-full bg-white/5 text-sm tabular-nums">
          {list.length} {list.length === 1 ? "room" : "rooms"}
        </span>
      </header>

      <div className="flex flex-col gap-2">
        {list.length === 0 ? (
          <div className="glass-card rounded-xl p-8 text-center text-white/50">
            No rooms yet. Send someone to <code>/</code> to create one.
          </div>
        ) : (
          list.map((r) => (
            <div
              key={r.id}
              className="glass-card rounded-xl p-4 flex items-center gap-4"
            >
              <div className="flex-1 min-w-0">
                <Link
                  href={`/r/${r.code}`}
                  className="font-display text-lg hover:underline"
                >
                  {r.name}
                </Link>
                <div className="flex items-center gap-3 text-xs text-white/50 mt-1">
                  <code className="tracking-[0.2em]">{r.code}</code>
                  <span>·</span>
                  <span>{r.voterCount} voters</span>
                  <span>·</span>
                  <span>active {timeAgo(r.lastActiveAt)}</span>
                </div>
              </div>
              <AdminRoomToggle code={r.code} initialEnabled={r.votingEnabled} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export const dynamic = "force-dynamic";
