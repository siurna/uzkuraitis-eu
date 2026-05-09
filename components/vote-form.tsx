"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  closestCenter,
} from "@dnd-kit/core";
import { motion, AnimatePresence } from "motion/react";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { countries, getCountry } from "@/lib/countries";
import { Flag } from "@/components/flag";

const POINT_VALUES = [12, 10, 8, 7, 6, 5, 4, 3, 2, 1] as const;
type Points = (typeof POINT_VALUES)[number];

type Slot = {
  points: Points;
  countryCode: string | null;
};

const STORAGE_KEY = (code: string) => `uzk_ballot_${code}`;
const PREDICTION_KEY = (code: string) => `uzk_home_${code}`;
const SESSION_KEY = "uzk_session";
const NAME_KEY = "uzk_name";

export function VoteForm({
  roomCode,
  roomName,
  homeCountryCode,
}: {
  roomCode: string;
  roomName: string;
  homeCountryCode: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slots, setSlots] = useState<Slot[]>(
    POINT_VALUES.map((p) => ({ points: p, countryCode: null })),
  );
  const [homePrediction, setHomePrediction] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const homeCountry = getCountry(homeCountryCode);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Restore session id + previous ballot + previous prediction on mount.
  useEffect(() => {
    if (!localStorage.getItem(SESSION_KEY)) {
      localStorage.setItem(SESSION_KEY, `s_${nanoid(16)}`);
    }
    setName(localStorage.getItem(NAME_KEY) ?? "");
    const stored = localStorage.getItem(STORAGE_KEY(roomCode));
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Slot[];
        if (Array.isArray(parsed) && parsed.length === 10) setSlots(parsed);
      } catch {
        /* ignore corrupt draft */
      }
    }
    const storedPrediction = localStorage.getItem(PREDICTION_KEY(roomCode));
    if (storedPrediction) setHomePrediction(storedPrediction);
  }, [roomCode]);

  // Persist drafts so a tap into another tab doesn't lose progress.
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY(roomCode), JSON.stringify(slots));
  }, [slots, roomCode]);

  useEffect(() => {
    if (homePrediction) {
      localStorage.setItem(PREDICTION_KEY(roomCode), homePrediction);
    } else {
      localStorage.removeItem(PREDICTION_KEY(roomCode));
    }
  }, [homePrediction, roomCode]);

  const usedCountryCodes = useMemo(
    () => new Set(slots.map((s) => s.countryCode).filter(Boolean) as string[]),
    [slots],
  );

  const remaining = countries.filter((c) => !usedCountryCodes.has(c.code));

  const filledCount = slots.filter((s) => s.countryCode).length;
  const allFilled = filledCount === 10;

  const assign = (points: Points, code: string) => {
    setSlots((prev) =>
      prev.map((s) =>
        s.points === points
          ? { ...s, countryCode: code }
          : s.countryCode === code
            ? { ...s, countryCode: null }
            : s,
      ),
    );
  };

  const clearSlot = (points: Points) => {
    setSlots((prev) =>
      prev.map((s) => (s.points === points ? { ...s, countryCode: null } : s)),
    );
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const oldIndex = slots.findIndex((s) => `slot-${s.points}` === active.id);
    const newIndex = slots.findIndex((s) => `slot-${s.points}` === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    // We move country assignments, not the point values themselves — points
    // stay fixed at 12,10,8,...,1. arrayMove on the country slice is what
    // the user actually sees and wants.
    const reorderedCountries = arrayMove(
      slots.map((s) => s.countryCode),
      oldIndex,
      newIndex,
    );
    setSlots(slots.map((s, i) => ({ ...s, countryCode: reorderedCountries[i] })));
  };

  const submit = async () => {
    if (!name.trim()) {
      toast.error("Add your name first.");
      return;
    }
    if (!allFilled) {
      toast.error(`Fill all 10 slots, ${10 - filledCount} to go.`);
      return;
    }
    setSubmitting(true);
    try {
      localStorage.setItem(NAME_KEY, name.trim());
      const sessionId = localStorage.getItem(SESSION_KEY)!;
      const ballot = Object.fromEntries(
        slots.map((s) => [String(s.points), s.countryCode!]),
      );
      const trimmedPrediction = homePrediction.trim();
      const predictionInt =
        trimmedPrediction === "" ? null : Number(trimmedPrediction);
      const res = await fetch(`/api/rooms/${roomCode}/votes`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          sessionId,
          votes: ballot,
          homePrediction:
            predictionInt && Number.isFinite(predictionInt)
              ? predictionInt
              : null,
        }),
      });
      if (!res.ok) {
        const { error } = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(error ?? "Couldn't submit vote.");
      }
      localStorage.setItem(`uzk_voted_${roomCode}`, "1");
      toast.success("Vote in. Tegyvuoja muzika!");
      router.push(`/r/${roomCode}`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col pb-32">
      <header className="sticky top-0 z-30 backdrop-blur-md bg-dark-blue-900/70 border-b border-white/5">
        <div className="container mx-auto max-w-3xl px-4 py-3 flex items-center gap-3">
          <Link
            href={`/r/${roomCode}`}
            className="flex-1 min-w-0 text-left hover:opacity-80 transition"
            aria-label="Back to standings"
          >
            <p className="font-display text-lg truncate">Cast your vote</p>
            <p className="text-xs text-white/50 truncate">{roomName}</p>
          </Link>
          <span className="text-xs px-2 py-1 rounded-full bg-white/5 tabular-nums">
            {filledCount}/10
          </span>
        </div>
      </header>

      <div className="container mx-auto max-w-3xl px-4 py-6 flex flex-col gap-8">
        <section className="glass-card rounded-2xl p-4 sm:p-5 flex flex-col gap-3">
          <h2 className="font-display text-xl gradient-text">Your top 10</h2>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
          >
            <SortableContext
              items={slots.map((s) => `slot-${s.points}`)}
              strategy={rectSortingStrategy}
            >
              <ul className="flex flex-col gap-2">
                {slots.map((slot) => (
                  <BallotSlot
                    key={slot.points}
                    slot={slot}
                    onClear={() => clearSlot(slot.points)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        </section>

        {homeCountry && (
          <section className="glass-card rounded-2xl p-4 sm:p-5 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <Flag code={homeCountry.code} size="lg" />
              <div className="flex-1 min-w-0">
                <h2 className="font-display text-xl gradient-text">
                  Where will {homeCountry.name} finish?
                </h2>
                <p className="text-xs text-white/50">
                  Closer guesses score more. Exact = 10, off by 1 = 7,
                  off by 2 = 5, off by 3 to 5 = 3, off by 6 to 10 = 1.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={countries.length}
                placeholder="?"
                value={homePrediction}
                onChange={(e) => setHomePrediction(e.target.value)}
                className="h-14 w-20 rounded-xl border border-white/15 bg-black/30
                           text-center font-display text-3xl tabular-nums text-white
                           caret-flamingo focus:border-flamingo focus:outline-none
                           focus:ring-2 focus:ring-flamingo/40 transition"
              />
              <span className="text-sm text-white/40">
                / {countries.length} finalists
              </span>
            </div>
          </section>
        )}

        <section className="glass-card rounded-2xl p-4 sm:p-5 flex flex-col gap-3">
          <h2 className="font-display text-xl gradient-text">
            Remaining countries
          </h2>
          <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {remaining.map((c) => {
              const nextSlot = slots.find((s) => !s.countryCode);
              return (
                <li key={c.code}>
                  <button
                    type="button"
                    disabled={!nextSlot}
                    onClick={() => nextSlot && assign(nextSlot.points, c.code)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg
                               bg-white/5 hover:bg-white/10 disabled:opacity-40
                               text-left transition"
                  >
                    <Flag code={c.code} size="sm" />
                    <span className="truncate text-sm">{c.name}</span>
                  </button>
                </li>
              );
            })}
            {remaining.length === 0 && (
              <li className="col-span-full text-center text-white/50 text-sm py-6">
                All assigned. Drag the rows above to reorder.
              </li>
            )}
          </ul>
        </section>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-20 bg-dark-blue-900/85 backdrop-blur-md border-t border-white/5 py-3">
        <div className="container mx-auto max-w-3xl px-4">
          <Button
            onClick={submit}
            disabled={submitting || !allFilled || !name.trim()}
            className="w-full h-14 text-lg font-display
                       bg-gradient-to-r from-gold via-flamingo to-purple
                       text-white shadow-glow-pink
                       disabled:opacity-40 disabled:bg-none disabled:bg-white/10"
          >
            {submitting ? "Submitting…" : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Submit my 12 points
              </>
            )}
          </Button>
        </div>
      </div>
    </main>
  );
}

function BallotSlot({
  slot,
  onClear,
}: {
  slot: Slot;
  onClear: () => void;
}) {
  const id = `slot-${slot.points}`;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const country = slot.countryCode ? getCountry(slot.countryCode) : null;
  const tone =
    slot.points === 12
      ? "border-gold/60 bg-gold/10"
      : slot.points === 10
        ? "border-flamingo/60 bg-flamingo/10"
        : "border-white/10 bg-white/5";

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.7 : 1,
      }}
      className={`list-entry-gradient flex items-center gap-3 rounded-xl border ${tone} p-3`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="text-white/40 hover:text-white/80 cursor-grab active:cursor-grabbing touch-none"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-5 w-5" />
      </button>

      <div className="w-12 text-center font-display text-2xl text-flamingo tabular-nums">
        {slot.points}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {country ? (
          <motion.div
            key={`filled-${country.code}`}
            initial={{ opacity: 0, x: 12, scale: 0.85 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -12, scale: 0.85 }}
            transition={{ type: "spring", stiffness: 480, damping: 28 }}
            className="flex flex-1 items-center gap-3 min-w-0"
          >
            <Flag code={country.code} size="md" />
            <div className="flex-1 min-w-0">
              <p className="font-display truncate">{country.name}</p>
              <p className="text-xs text-white/55 truncate">
                {country.artist} — <span className="italic">{country.song}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={onClear}
              className="text-white/40 hover:text-error transition"
              aria-label="Clear slot"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        ) : (
          <motion.p
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 text-sm text-white/40 italic"
          >
            Tap a country below or drag here
          </motion.p>
        )}
      </AnimatePresence>
    </li>
  );
}
