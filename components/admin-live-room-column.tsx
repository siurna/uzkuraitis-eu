"use client";

import { useEffect, useState } from "react";
import { AdminRoomPicker } from "@/components/admin-room-picker";
import { AdminLiveControls } from "@/components/admin-live-controls";

// Right column of /admin/live. Compressed to the minimum: the
// room picker chip at the top + a single "Room controls" CTA below
// it. The control opens a bottom-sheet with the voting/results
// switches plus every broadcast shot. Everything that used to live
// here as standalone tile cards (AdminBroadcasts, voting toggle,
// tally toggle) moved into that drawer.
export type RoomLite = {
  code: string;
  name: string;
  votingEnabled: boolean;
  tallyEnabled: boolean;
};

const ROOM_STORAGE_KEY = "uzk_admin_live_room";

export function AdminLiveRoomColumn({ rooms }: { rooms: RoomLite[] }) {
  const [room, setRoom] = useState<string>(rooms[0]?.code ?? "");

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
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs uppercase tracking-[0.18em] text-white/40 font-display">
          Room
        </span>
        <AdminRoomPicker
          rooms={rooms}
          value={room}
          onChange={choose}
          className="min-w-[12rem]"
        />
      </div>

      <AdminLiveControls
        rooms={rooms}
        room={selected?.code ?? ""}
        initialVoting={selected?.votingEnabled ?? false}
        initialTally={selected?.tallyEnabled ?? false}
      />
    </div>
  );
}
