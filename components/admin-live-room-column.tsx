"use client";

import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { AdminBroadcasts } from "@/components/admin-broadcasts";
import { AdminRoomVotingToggleCard } from "@/components/admin-room-voting-toggle-card";
import { AdminRoomTallyToggle } from "@/components/admin-room-tally-toggle";

// Right column of /admin/live: a single room selector at the top
// that drives BOTH the broadcasts widget and the per-room voting /
// results toggles below it. One dropdown, one state, no
// duplicated "pick a room" picker per section.
export type RoomLite = {
  code: string;
  name: string;
  votingEnabled: boolean;
  tallyEnabled: boolean;
};

const ROOM_STORAGE_KEY = "uzk_admin_live_room";

export function AdminLiveRoomColumn({ rooms }: { rooms: RoomLite[] }) {
  const [room, setRoom] = useState<string>(rooms[0]?.code ?? "");

  // Persist + restore the selection so reopening the page lands on
  // whatever the admin was last running broadcasts into.
  useEffect(() => {
    const saved = localStorage.getItem(ROOM_STORAGE_KEY);
    if (saved && rooms.some((r) => r.code === saved)) setRoom(saved);
  }, [rooms]);

  const choose = (code: string) => {
    setRoom(code);
    try {
      localStorage.setItem(ROOM_STORAGE_KEY, code);
    } catch {
      /* ignore */
    }
  };

  const selected = rooms.find((r) => r.code === room) ?? rooms[0] ?? null;

  return (
    <div className="flex flex-col gap-4">
      {/* Shared room selector. Sits above both the broadcasts widget
          and the voting/results card so picking a room once drives
          every action in this column. */}
      <label className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
        <span className="text-xs uppercase tracking-[0.18em] text-white/40 font-display sm:w-20 shrink-0">
          Room
        </span>
        {rooms.length === 0 ? (
          <span className="text-sm text-white/40">No rooms yet.</span>
        ) : (
          <select
            value={room}
            onChange={(e) => choose(e.target.value)}
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

      <AdminBroadcasts rooms={rooms} room={room} onRoomChange={choose} hideRoomPicker />

      {selected && (
        <section className="flex flex-col gap-4 pt-4">
          <header className="flex items-start gap-3">
            <div
              className="h-10 w-10 rounded-2xl bg-flamingo/15 ring-1 ring-flamingo/30
                         grid place-items-center text-flamingo shrink-0"
            >
              <Trophy className="h-5 w-5" fill="currentColor" />
            </div>
            <div>
              <h2 className="font-display text-xl leading-tight">Voting &amp; Results</h2>
              <p className="text-sm text-white/45 leading-snug mt-0.5">
                Quick toggles for the room above. Same controls as Rooms › Settings.
              </p>
            </div>
          </header>
          <div className="flex flex-col gap-3">
            <AdminRoomVotingToggleCard
              key={`vote-${selected.code}`}
              code={selected.code}
              initialEnabled={selected.votingEnabled}
            />
            <AdminRoomTallyToggle
              key={`tally-${selected.code}`}
              code={selected.code}
              initialEnabled={selected.tallyEnabled}
            />
          </div>
        </section>
      )}
    </div>
  );
}
