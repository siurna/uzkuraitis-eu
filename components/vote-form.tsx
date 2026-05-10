"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { createPortal } from "react-dom";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { X, Send, ListOrdered, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { countries, getCountry } from "@/lib/countries";
import { Flag } from "@/components/flag";
import { BonusBetsForm } from "@/components/bonus-bets-form";
import { CountryDrawer } from "@/components/country-drawer";
import type { Bets } from "@/lib/scoring";
import { useLang, t } from "@/lib/i18n";

const POINT_VALUES = [12, 10, 8, 7, 6, 5, 4, 3, 2, 1] as const;
type Points = (typeof POINT_VALUES)[number];

type Slot = {
  points: Points;
  countryCode: string | null;
};

const STORAGE_KEY = (code: string) => `uzk_ballot_${code}`;
const PREDICTION_KEY = (code: string) => `uzk_home_${code}`;
const BETS_KEY = (code: string) => `uzk_bets_${code}`;
const SESSION_KEY = "uzk_session";
const NAME_KEY = "uzk_name";

export function VoteForm({
  roomCode,
  homeCountryCode,
}: {
  roomCode: string;
  homeCountryCode: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slots, setSlots] = useState<Slot[]>(
    POINT_VALUES.map((p) => ({ points: p, countryCode: null })),
  );
  const [homePrediction, setHomePrediction] = useState<string>("");
  const [bets, setBets] = useState<Bets>({});
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState<"ballot" | "bets">("ballot");
  // Which ballot slot is currently being edited via the country drawer.
  const [pickingPoints, setPickingPoints] = useState<Points | null>(null);
  // Slot that just got filled, gets a one-shot heartbeat pulse.
  const [pulsingPoints, setPulsingPoints] = useState<Points | null>(null);
  // One-shot heart particle that flies from screen centre into the
  // freshly-filled slot's heart spot. Spawned after assign().
  const [flyingHeart, setFlyingHeart] = useState<{
    id: number;
    code: string;
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
  } | null>(null);

  const homeCountry = getCountry(homeCountryCode);
  const lang = useLang();

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
    const storedBets = localStorage.getItem(BETS_KEY(roomCode));
    if (storedBets) {
      try {
        setBets(JSON.parse(storedBets) as Bets);
      } catch {
        /* ignore corrupt bet draft */
      }
    }
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

  useEffect(() => {
    localStorage.setItem(BETS_KEY(roomCode), JSON.stringify(bets));
  }, [bets, roomCode]);

  const usedCountryCodes = useMemo(
    () => new Set(slots.map((s) => s.countryCode).filter(Boolean) as string[]),
    [slots],
  );

  const filledCount = slots.filter((s) => s.countryCode).length;
  const allFilled = filledCount === 10;

  // The moment the user fills the 10th slot, slide them over to the
  // Bonus bets tab so they don't accidentally submit without scoring
  // any side bets. Only fires on the 9 -> 10 transition; subsequent
  // edits stay where they are.
  const wasFullRef = useRef(false);
  useEffect(() => {
    if (allFilled && !wasFullRef.current) {
      wasFullRef.current = true;
      setTab("bets");
    }
    if (!allFilled) wasFullRef.current = false;
  }, [allFilled]);

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
    // Wait for the picker drawer to slide down (~0.28s), then:
    //  1. spawn a heart that flies from screen centre into the slot's
    //     heart spot (data-slot-target=<points> selector),
    //  2. as the heart lands, kick off the slot's heartbeat pulse.
    window.setTimeout(() => {
      if (typeof document !== "undefined") {
        const target = document.querySelector(
          `[data-slot-target="${points}"]`,
        );
        if (target) {
          const rect = target.getBoundingClientRect();
          setFlyingHeart({
            id: Date.now(),
            code,
            fromX: window.innerWidth / 2,
            fromY: window.innerHeight / 2,
            toX: rect.left + rect.width / 2,
            toY: rect.top + rect.height / 2,
          });
        }
      }
      // Pulse + clear the flying heart shortly after it lands.
      window.setTimeout(() => {
        setPulsingPoints(points);
        window.setTimeout(() => setPulsingPoints(null), 1100);
      }, 520);
      window.setTimeout(() => setFlyingHeart(null), 700);
    }, 320);
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
      toast.error(t(lang, "add_name_first"));
      return;
    }
    if (!allFilled) {
      toast.error(t(lang, "fill_n_more", 10 - filledCount));
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
          bets,
        }),
      });
      if (!res.ok) {
        const { error } = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(error ?? t(lang, "couldnt_submit"));
      }
      localStorage.setItem(`uzk_voted_${roomCode}`, "1");
      toast.success(t(lang, "voted_toast"));
      router.push(`/r/${roomCode}`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col pb-12">
      <header className="sticky top-0 z-30 backdrop-blur-md bg-dark-blue-900/70 border-b border-white/5">
        <div className="container mx-auto max-w-3xl px-4 py-3 flex items-center gap-3">
          <Link
            href={`/r/${roomCode}`}
            className="flex-1 min-w-0 text-left hover:opacity-80 transition flex items-center gap-2.5"
            aria-label="Back to standings"
          >
            <motion.div
              animate={{ scale: [1, 1.18, 1, 1.1, 1] }}
              transition={{
                duration: 1.1,
                times: [0, 0.18, 0.36, 0.5, 1],
                repeat: Infinity,
                repeatDelay: 0.5,
                ease: "easeInOut",
              }}
              className="origin-center shrink-0"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/70-heart-sm.webp"
                alt=""
                className="h-7 w-7 object-contain"
              />
            </motion.div>
            <p className="font-display text-lg truncate">{t(lang, "cast_your_vote")}</p>
          </Link>
          {/* Tabs live in the header on every screen so they stay in reach
              when you scroll past the long ballot. */}
          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as "ballot" | "bets")}
          >
            <TabsList className="h-9">
              <TabsTrigger value="ballot" className="px-3 py-1 text-xs">
                <ListOrdered className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t(lang, "tab_ballot")}</span>
              </TabsTrigger>
              <TabsTrigger value="bets" className="px-3 py-1 text-xs">
                <Sparkles className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t(lang, "tab_bets")}</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </header>

      <div className="container mx-auto max-w-3xl px-4 py-6 flex flex-col gap-6">
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as "ballot" | "bets")}
          className="flex flex-col gap-4"
        >
          <TabsContent value="ballot" className="flex flex-col gap-6 mt-0 outline-none">
            <motion.section
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="glass-card rounded-2xl p-4 sm:p-5 flex flex-col gap-3"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-display text-xl gradient-text">
                  {t(lang, "your_top_10")}
                </h2>
                <p className="text-xs text-white/40">
                  {t(lang, "drag_hint")}
                </p>
              </div>
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
                        onPick={() => setPickingPoints(slot.points)}
                        pulsing={pulsingPoints === slot.points}
                      />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>
            </motion.section>
          </TabsContent>

          <TabsContent value="bets" className="flex flex-col gap-4 mt-0 outline-none">
            {homeCountry && (
              <motion.section
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                className="glass-card rounded-2xl p-4 sm:p-5 flex flex-col gap-3"
              >
                <div className="flex items-center gap-3">
                  <Flag code={homeCountry.code} size="lg" />
                  <div className="flex-1 min-w-0">
                    <h2 className="font-display text-xl gradient-text">
                      {homeCountry.name} placement
                    </h2>
                    <p className="text-xs text-white/50">
                      Exact 10, off-by-1 7, off-by-2 5, off-by-3 to 5 3,
                      off-by-6 to 10 1, beyond 0.
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
              </motion.section>
            )}

            <BonusBetsForm
              homeCountryCode={homeCountryCode}
              bets={bets}
              onChange={setBets}
            />

            <p className="text-xs text-white/40 text-center pt-1">
              Skip any bet you don&apos;t want to take. Skipped = 0 pts
              for that bet.
            </p>
          </TabsContent>
        </Tabs>
      </div>

      {/* Inline submit, no sticky footer container. Lives at the
          natural end of the form so the page bg owns the chrome. */}
      <div className="container mx-auto max-w-3xl px-4 pb-10">
        <Button
          onClick={submit}
          disabled={submitting || !allFilled || !name.trim()}
          className="w-full h-14 text-lg font-display
                     bg-gradient-to-r from-gold via-flamingo to-purple
                     text-white shadow-glow-pink
                     disabled:opacity-40 disabled:bg-none disabled:bg-white/10"
        >
          {submitting ? t(lang, "submitting") : (
            <>
              <Send className="h-4 w-4 mr-2" />
              {allFilled
                ? t(lang, "submit_12")
                : t(lang, "pick_n_more", 10 - filledCount)}
            </>
          )}
        </Button>
      </div>

      {/* Country picker for the ballot. The "options" list excludes
          countries already used elsewhere on the ballot, except for
          the country currently in the slot being edited (so swap is
          a no-op tap if you change your mind). */}
      <CountryDrawer
        title={
          pickingPoints != null
            ? `Pick the country for ${pickingPoints} points`
            : ""
        }
        sub="Tap to assign. Changes auto-swap if the country is already in another slot."
        open={pickingPoints != null}
        onClose={() => setPickingPoints(null)}
        selected={
          pickingPoints != null
            ? [
                slots.find((s) => s.points === pickingPoints)?.countryCode ??
                  "",
              ].filter(Boolean)
            : []
        }
        onPick={(v) => {
          if (typeof v === "string" && pickingPoints != null) {
            assign(pickingPoints, v);
          }
          setPickingPoints(null);
        }}
        options={countries
          .filter((c) => {
            if (
              pickingPoints != null &&
              slots.find((s) => s.points === pickingPoints)?.countryCode ===
                c.code
            )
              return true;
            return !usedCountryCodes.has(c.code);
          })
          .map((c) => c.code)}
      />

      <FlyingHeartToSlot heart={flyingHeart} />
    </main>
  );
}

// A single heart-flag chip portaled to body that arcs from screen
// centre into the slot's heart spot. Uses framer's keyframe array
// for a soft drop-and-settle motion (over-shoot then settle).
function FlyingHeartToSlot({
  heart,
}: {
  heart: { id: number; code: string; fromX: number; fromY: number; toX: number; toY: number } | null;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {heart && (
        <motion.div
          key={heart.id}
          initial={{
            left: heart.fromX - 28,
            top: heart.fromY - 28,
            opacity: 0,
            scale: 0.4,
            rotate: 0,
          }}
          animate={{
            left: [heart.fromX - 28, heart.toX - 18],
            top: [heart.fromY - 28, heart.toY - 18],
            opacity: [0, 1, 1, 0],
            scale: [0.4, 1.4, 1, 0.4],
            rotate: [0, -8, 4, 0],
          }}
          transition={{
            duration: 0.62,
            ease: [0.34, 1.2, 0.64, 1],
            opacity: { times: [0, 0.18, 0.7, 1] },
            scale: { times: [0, 0.35, 0.7, 1] },
          }}
          className="fixed h-14 w-14 z-[70] pointer-events-none
                     drop-shadow-[0_8px_24px_rgba(255,46,222,0.55)]"
        >
          <Flag code={heart.code} size="xl" className="h-full w-full" />
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function BallotSlot({
  slot,
  onClear,
  onPick,
  pulsing,
}: {
  slot: Slot;
  onClear: () => void;
  onPick: () => void;
  pulsing: boolean;
}) {
  const lang = useLang();
  return <BallotSlotInner slot={slot} onClear={onClear} onPick={onPick} pulsing={pulsing} lang={lang} />;
}

function BallotSlotInner({
  slot,
  onClear,
  onPick,
  pulsing,
  lang,
}: {
  slot: Slot;
  onClear: () => void;
  onPick: () => void;
  pulsing: boolean;
  lang: "en" | "lt";
}) {
  const id = `slot-${slot.points}`;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const country = slot.countryCode ? getCountry(slot.countryCode) : null;
  // The 12/10/8 slots get a coloured points badge instead of a tinted
  // border so the row borders stay consistent with the rest of the app
  // (one design system, fewer competing border colours).
  const pointsColor =
    slot.points === 12
      ? "text-gold"
      : slot.points === 10
        ? "text-flamingo"
        : slot.points === 8
          ? "text-orange"
          : "text-flamingo/80";

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.7 : 1,
      }}
      // min-h pre-allocates the picked-state height so the row doesn't
      // jump taller the moment a country is chosen.
      // Quiet tile to match the bonus-bets + standings rows. The
      // points-color on the left already differentiates 12 / 10 / 8.
      // min-h pre-allocates the picked-state height so the row doesn't
      // jump taller the moment a country is chosen.
      className="flex items-stretch rounded-2xl min-h-[4.5rem]
                 bg-white/[0.04] ring-1 ring-white/8
                 hover:bg-white/[0.06] hover:ring-white/15 transition"
    >
      {/* Drag handle = the points-number + flag block on the left.
          @dnd-kit listeners attach here so the whole left side feels
          grabbable. The country text on the right is the tap-to-pick
          surface; X on the far right clears. */}
      <div
        {...attributes}
        {...listeners}
        role="button"
        aria-label="Drag to reorder"
        className="flex items-center gap-3 pl-3 pr-1 py-3 cursor-grab
                   active:cursor-grabbing touch-none select-none"
      >
        <span
          className={`w-10 text-center font-display text-2xl ${pointsColor} tabular-nums shrink-0`}
        >
          {slot.points}
        </span>
        <AnimatePresence mode="wait" initial={false}>
          {country ? (
            <motion.span
              key={`flag-${country.code}`}
              data-slot-target={slot.points}
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={{ type: "spring", stiffness: 480, damping: 28 }}
              className={`shrink-0 ${pulsing ? "heartbeat inline-block" : "inline-block"}`}
            >
              <Flag code={country.code} size="md" />
            </motion.span>
          ) : (
            // Dotted heart placeholder — outline-only SVG that matches
            // the .heart clip used everywhere else, so the empty slot
            // already looks like a country chip waiting to be filled.
            <span
              data-slot-target={slot.points}
              className="shrink-0 inline-flex items-center justify-center h-9 w-9"
              aria-hidden
            >
              <svg viewBox="0 0 32 32" className="h-9 w-9 text-white/30">
                <path
                  d="M16 28 C16 28, 3 19, 3 11 C3 6.5, 6.5 4, 10 4 C12.8 4, 15 6, 16 8.5 C17 6, 19.2 4, 22 4 C25.5 4, 29 6.5, 29 11 C29 19, 16 28, 16 28 Z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeDasharray="2.5 2.5"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          )}
        </AnimatePresence>
      </div>

      <button
        type="button"
        onClick={onPick}
        className="flex flex-1 items-center gap-3 px-1 py-3 min-w-0 text-left
                   transition transform-gpu duration-150
                   hover:bg-white/[0.04] active:scale-[0.99]"
        aria-label={
          country
            ? `Change ${slot.points} pts pick`
            : `Pick ${slot.points} pts country`
        }
      >
        <AnimatePresence mode="wait" initial={false}>
          {country ? (
            <motion.div
              key={`text-${country.code}`}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.18 }}
              className="flex-1 min-w-0"
            >
              <p className="font-display truncate leading-tight">
                {country.name}
              </p>
              <p className="text-xs text-white/55 truncate leading-tight">
                {country.artist}
                {country.song && (
                  <>
                    {" · "}
                    <span className="italic text-white/45">{country.song}</span>
                  </>
                )}
              </p>
            </motion.div>
          ) : (
            <motion.p
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 text-sm text-white/40 italic"
            >
              {t(lang, "tap_to_pick")}
            </motion.p>
          )}
        </AnimatePresence>
      </button>

      {country && (
        <button
          type="button"
          onClick={onClear}
          className="text-white/40 hover:text-error transition px-3"
          aria-label="Clear slot"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </li>
  );
}
