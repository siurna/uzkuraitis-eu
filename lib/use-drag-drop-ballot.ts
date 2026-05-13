"use client";

import { useState } from "react";
import {
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";

// Drag-and-drop wiring for the TOP-10 ballot. Owns:
//   • the dnd-kit sensors tuned for the room (mouse needs 6px of travel
//     before claiming a drag; touch waits 120ms so a tap-and-hold opens
//     the country picker instead of starting a drag);
//   • the slot-reorder handler — points stay nailed (12,10,8…1), only
//     country assignments move;
//   • the post-drop flash state (`flashedSlots`) so every row the drag
//     shuffled past briefly flamingo-flashes, and the row it landed in
//     gets a one-shot heartbeat.
export function useDragDropBallot<Points extends number>({
  slots,
  setSlots,
  setPulsingPoints,
}: {
  slots: { points: Points; countryCode: string | null }[];
  setSlots: (next: { points: Points; countryCode: string | null }[]) => void;
  setPulsingPoints: (p: Points | null) => void;
}) {
  const [flashedSlots, setFlashedSlots] = useState<ReadonlySet<Points>>(
    () => new Set(),
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 120, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const oldIndex = slots.findIndex((s) => `slot-${s.points}` === active.id);
    const newIndex = slots.findIndex((s) => `slot-${s.points}` === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    // Points stay fixed at 12,10,8…1 — we shuffle the country slice and
    // re-pin each entry's existing point value.
    const reorderedCountries = arrayMove(
      slots.map((s) => s.countryCode),
      oldIndex,
      newIndex,
    );
    setSlots(slots.map((s, i) => ({ ...s, countryCode: reorderedCountries[i] })));
    const lo = Math.min(oldIndex, newIndex);
    const hi = Math.max(oldIndex, newIndex);
    setFlashedSlots(new Set(slots.slice(lo, hi + 1).map((s) => s.points)));
    setPulsingPoints(slots[newIndex].points);
    window.setTimeout(() => {
      setFlashedSlots(new Set());
      setPulsingPoints(null);
    }, 1100);
  };

  return { sensors, onDragEnd, flashedSlots };
}
