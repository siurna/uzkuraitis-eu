"use client";

import { useEffect, useState } from "react";
import { Radio } from "lucide-react";
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
  triviaMaxAnswerers: number | null;
  highlightThreshold: number | null;
  /** Recently active voter count (within the last ~2 minutes). Shown
   *  as a small dot+number badge on the picker chip. */
  activeCount: number;
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
      <header className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-flamingo/15 ring-1 ring-flamingo/30 text-flamingo">
          <Radio className="h-5 w-5" />
        </span>
        <div className="flex-1 min-w-0">
          <h2 className="font-display text-xl leading-tight">Room</h2>
          <p className="text-sm text-white/45 leading-snug mt-0.5">
            Pick which room these controls aim at.
          </p>
        </div>
      </header>

      <AdminRoomPicker
        rooms={rooms}
        value={room}
        onChange={choose}
        className="w-full"
      />

      <AdminLiveControls
        rooms={rooms}
        room={selected?.code ?? ""}
        initialVoting={selected?.votingEnabled ?? false}
        initialTally={selected?.tallyEnabled ?? false}
        initialTriviaCap={selected?.triviaMaxAnswerers ?? null}
        initialHighlightThreshold={selected?.highlightThreshold ?? null}
      />
    </div>
  );
}
