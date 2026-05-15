"use client";

import { useEffect, useMemo, useState } from "react";
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
// How often the picker re-pulls per-room active counts so the badge
// updates without a page reload. 15s is a sweet spot — counts feel
// live during the show, the endpoint stays cheap (one grouped query
// against `voters`), and the dot stops "pinging" the moment someone
// closes their tab.
const ACTIVE_POLL_MS = 15_000;

export function AdminLiveRoomColumn({ rooms: initialRooms }: { rooms: RoomLite[] }) {
  const [room, setRoom] = useState<string>(initialRooms[0]?.code ?? "");
  // Live `activeCount` overrides keyed by room code. Polled from
  // `/api/admin/rooms/active-counts`; falls back to the SSR value when
  // a code isn't in the latest payload (handles a freshly-created
  // room that the poll hasn't seen yet without flashing a zero).
  const [liveCounts, setLiveCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const saved = localStorage.getItem(ROOM_STORAGE_KEY);
    if (saved && initialRooms.some((r) => r.code === saved)) setRoom(saved);
  }, [initialRooms]);

  // Poll the active counts endpoint on a fixed cadence. Skips when
  // the tab is hidden so a backgrounded admin tab doesn't keep
  // pinging the DB; resumes on `visibilitychange`.
  useEffect(() => {
    let cancelled = false;
    const fetchCounts = async () => {
      try {
        const res = await fetch("/api/admin/rooms/active-counts", {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as { counts?: Record<string, number> };
        if (!cancelled && data.counts) setLiveCounts(data.counts);
      } catch {
        /* network blip — keep the last good payload */
      }
    };
    fetchCounts();
    let id: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (id != null) return;
      id = setInterval(fetchCounts, ACTIVE_POLL_MS);
    };
    const stop = () => {
      if (id != null) {
        clearInterval(id);
        id = null;
      }
    };
    if (typeof document !== "undefined" && document.visibilityState === "visible") {
      start();
    }
    const onVis = () => {
      if (document.visibilityState === "visible") {
        fetchCounts();
        start();
      } else {
        stop();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      stop();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const choose = (code: string) => {
    setRoom(code);
    try {
      localStorage.setItem(ROOM_STORAGE_KEY, code);
    } catch {
      /* ignore */
    }
  };

  // Merge polled counts on top of the SSR initial rooms so the badge
  // updates in place when participants join / drop without a reload.
  const rooms = useMemo<RoomLite[]>(
    () =>
      initialRooms.map((r) => ({
        ...r,
        activeCount: liveCounts[r.code] ?? r.activeCount,
      })),
    [initialRooms, liveCounts],
  );
  const selected = rooms.find((r) => r.code === room) ?? rooms[0] ?? null;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-flamingo/15 ring-1 ring-flamingo/30 text-flamingo">
          <Radio className="h-5 w-5" />
        </span>
        <div className="flex-1 min-w-0">
          <h2 className="font-display text-xl leading-tight">Room</h2>
          <p className="text-sm text-white/45 leading-snug mt-0.5 text-balance">
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
