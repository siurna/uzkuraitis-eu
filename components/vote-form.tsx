"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { X, ListOrdered, Sparkles, Share2, Check, ScrollText } from "lucide-react";
import { countries, getCountry, countryName } from "@/lib/countries";
import { Flag, HeartOutline } from "@/components/flag";
import { BonusBetsForm } from "@/components/bonus-bets-form";
import { CountryDrawer } from "@/components/country-drawer";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { useIdentity } from "@/lib/use-identity";
import type { Bets } from "@/lib/scoring";
import { useLang, t, fmt } from "@/lib/i18n";

const POINT_VALUES = [12, 10, 8, 7, 6, 5, 4, 3, 2, 1] as const;
type Points = (typeof POINT_VALUES)[number];

type Slot = {
  points: Points;
  countryCode: string | null;
};

type VoteTab = "ballot" | "bets" | "rules";
const VOTE_TABS: { id: VoteTab; icon: typeof ListOrdered; labelKey: "tab_ballot" | "tab_bets" | "tab_rules" }[] = [
  { id: "ballot", icon: ListOrdered, labelKey: "tab_ballot" },
  { id: "bets", icon: Sparkles, labelKey: "tab_bets" },
  { id: "rules", icon: ScrollText, labelKey: "tab_rules" },
];

const STORAGE_KEY = (code: string) => `uzk_ballot_${code}`;
const PREDICTION_KEY = (code: string) => `uzk_home_${code}`;
const BETS_KEY = (code: string) => `uzk_bets_${code}`;

export function VoteForm({
  roomCode,
  homeCountryCode,
}: {
  roomCode: string;
  homeCountryCode: string;
}) {
  const { name, sessionId } = useIdentity();
  const [slots, setSlots] = useState<Slot[]>(
    POINT_VALUES.map((p) => ({ points: p, countryCode: null })),
  );
  const [homePrediction, setHomePrediction] = useState<string>("");
  const [bets, setBets] = useState<Bets>({});
  // Vote lifecycle. The ballot auto-casts the moment all 10 slots are
  // filled (no submit button). After that, reorders/swaps/bet edits set
  // `dirty`; a Save button re-POSTs. `autoCastFailed` surfaces a manual
  // retry button if the auto-cast network call blew up.
  const [hasCast, setHasCast] = useState(false);
  const [casting, setCasting] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [autoCastFailed, setAutoCastFailed] = useState(false);
  const [showCongrats, setShowCongrats] = useState(false);
  const [voterId, setVoterId] = useState<string | null>(null);
  const [tab, setTab] = useState<VoteTab>("ballot");
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

  // Restore previous ballot / prediction / bets on mount.
  useEffect(() => {
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
    if (localStorage.getItem(`uzk_voted_${roomCode}`) === "1") {
      setHasCast(true);
      setVoterId(localStorage.getItem(`uzk_voter_${roomCode}`));
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

  // Auto-cast: the first time all 10 slots are full (and we have a
  // name), POST the ballot automatically. No submit button. Re-runs are
  // gated by `hasCast` (set on success) and `autoCastFailed` (set on a
  // network blow-up — a manual retry button takes over from there).
  useEffect(() => {
    if (hasCast || casting || autoCastFailed) return;
    if (!allFilled || !name.trim()) return;
    void castVote(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allFilled, hasCast, casting, autoCastFailed, name]);

  // Once cast, any change to the ballot / bets / home prediction marks
  // the vote dirty so the Save button lights up. `dirtyArmed` swallows
  // the render where the vote first becomes cast (or is restored from
  // localStorage) so a fresh cast doesn't start out dirty.
  const dirtyArmed = useRef(false);
  useEffect(() => {
    if (!hasCast) {
      dirtyArmed.current = false;
      return;
    }
    if (!dirtyArmed.current) {
      dirtyArmed.current = true;
      return;
    }
    setDirty(true);
  }, [hasCast, slots, bets, homePrediction]);

  const assign = (points: Points, code: string) => {
    // Clear the country from any OTHER slot it might be in
    // immediately — but the destination slot stays empty (showing the
    // dashed-heart placeholder) until the flying heart lands. This
    // makes the fly-in feel like "the country gets placed", not
    // "the country was already there and a heart came later".
    setSlots((prev) =>
      prev.map((s) =>
        s.points !== points && s.countryCode === code
          ? { ...s, countryCode: null }
          : s,
      ),
    );
    // Wait one frame for the drawer's slide-down to begin, then:
    //   1. spawn the flying heart from screen-centre → slot's heart spot.
    //   2. as the heart lands (~480ms), drop the country into the slot
    //      AND kick off its heartbeat pulse.
    window.setTimeout(() => {
      if (typeof document === "undefined") return;
      const target = document.querySelector(
        `[data-slot-target="${points}"]`,
      );
      if (!target) {
        // Couldn't measure — just fill the slot directly.
        setSlots((prev) =>
          prev.map((s) => (s.points === points ? { ...s, countryCode: code } : s)),
        );
        return;
      }
      const rect = target.getBoundingClientRect();
      setFlyingHeart({
        id: Date.now(),
        code,
        fromX: window.innerWidth / 2,
        fromY: window.innerHeight / 2,
        toX: rect.left + rect.width / 2,
        toY: rect.top + rect.height / 2,
      });
      // Heart lands ~480ms in (62% of the 0.62s flight). Fill the slot
      // + pulse on landing so the country materialising reads as the
      // heart "becoming" the flag.
      window.setTimeout(() => {
        setSlots((prev) =>
          prev.map((s) => (s.points === points ? { ...s, countryCode: code } : s)),
        );
        setPulsingPoints(points);
        window.setTimeout(() => setPulsingPoints(null), 1100);
      }, 460);
      window.setTimeout(() => setFlyingHeart(null), 700);
    }, 280);
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

  const castVote = async (isUpdate: boolean) => {
    if (!name.trim()) {
      toast.error(t(lang, "add_name_first"));
      return;
    }
    if (!allFilled) {
      toast.error(t(lang, "fill_n_more", 10 - filledCount));
      return;
    }
    setCasting(true);
    try {
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
          sessionId: sessionId(),
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
      const data = (await res.json().catch(() => ({}))) as { voterId?: string };
      localStorage.setItem(`uzk_voted_${roomCode}`, "1");
      if (data.voterId) {
        localStorage.setItem(`uzk_voter_${roomCode}`, data.voterId);
        setVoterId(data.voterId);
      }
      setHasCast(true);
      setDirty(false);
      setAutoCastFailed(false);
      if (isUpdate) {
        toast.success(t(lang, "vote_updated_toast"));
      } else {
        toast.success(t(lang, "voted_toast"));
        setShowCongrats(true);
      }
    } catch (err) {
      toast.error((err as Error).message);
      if (!isUpdate) setAutoCastFailed(true);
    } finally {
      setCasting(false);
    }
  };

  const shareTop10 = async () => {
    if (!voterId || typeof window === "undefined") return;
    const url = `${window.location.origin}/api/og/${roomCode}/${voterId}`;
    const text = t(lang, "share_picks_caption");
    if ("share" in navigator) {
      try {
        await navigator.share({ title: text, text, url });
        return;
      } catch {
        /* cancelled — fall through to copy */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t(lang, "link_copied"));
    } catch {
      toast.error(t(lang, "couldnt_copy"));
    }
  };

  return (
    <main className="flex-1 flex flex-col pb-12">
      <div className="container mx-auto max-w-3xl px-4 pt-5 pb-6 flex flex-col gap-5">
        {/* Ballot / Bets / Rules toggle, inline at the top of the body. */}
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-1 rounded-2xl bg-black/40 ring-1 ring-white/10 p-1">
            {VOTE_TABS.map(({ id, icon: Icon, labelKey }) => {
              const isActive = tab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className="relative px-4 sm:px-5 h-11 rounded-xl font-display text-sm flex items-center gap-1.5"
                >
                  {isActive && (
                    <motion.span
                      layoutId="vote-tab-pill"
                      className="absolute inset-0 rounded-xl bg-white"
                      transition={{ type: "spring", stiffness: 360, damping: 30 }}
                    />
                  )}
                  <span
                    className={`relative flex items-center gap-1.5 ${
                      isActive ? "text-dark-blue" : "text-white/65"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {t(lang, labelKey)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab panels — cross-fade/slide on switch (mode="wait" so the
            outgoing panel finishes leaving before the new one arrives). */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col gap-4"
          >
            {tab === "ballot" && (
              <section className="flex flex-col gap-3">
                <div className="flex items-baseline justify-between gap-3 px-1">
                  <h2 className="font-display text-xl gradient-text">{t(lang, "your_top_10")}</h2>
                  <p className="text-xs text-white/40">{t(lang, "drag_hint")}</p>
                </div>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                  <SortableContext items={slots.map((s) => `slot-${s.points}`)} strategy={rectSortingStrategy}>
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
              </section>
            )}

            {tab === "bets" && (
              <>
                {homeCountry && (
                  <section className="glass-card rounded-2xl p-4 sm:p-5 flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <Flag code={homeCountry.code} size="lg" />
                      <div className="flex-1 min-w-0">
                        <h2 className="font-display text-xl gradient-text">
                          {fmt(t(lang, "bet_lt_placement"), { home: countryName(homeCountry.code, lang) })}
                        </h2>
                        <p className="text-xs text-white/50">
                          {fmt(t(lang, "bet_lt_placement_sub"), { home: countryName(homeCountry.code, lang) })}
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
                      <span className="text-sm text-white/40">/ {countries.length} {t(lang, "finalists")}</span>
                    </div>
                  </section>
                )}
                <BonusBetsForm homeCountryCode={homeCountryCode} bets={bets} onChange={setBets} />
              </>
            )}

            {tab === "rules" && (
              <section className="flex flex-col gap-3">
                <h2 className="font-display text-xl gradient-text text-balance px-1">{t(lang, "rules_title")}</h2>
                <RuleCard title={t(lang, "rules_top10_h")} body={t(lang, "rules_top10_b")} />
                <RuleCard title={t(lang, "rules_home_h")} body={t(lang, "rules_home_b")} />
                <RuleCard title={t(lang, "rules_bets_h")} body={t(lang, "rules_bets_b")} />
                <p className="text-xs text-white/40 text-center pt-1 text-balance">{t(lang, "rules_footer")}</p>
              </section>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom action area. The ballot auto-casts when full, so there's
          no submit button — only a Save button once the cast vote has
          been reordered (or a manual retry if the auto-cast failed). */}
      <div className="container mx-auto max-w-3xl px-4 pb-10 flex flex-col gap-2">
        {!hasCast && !allFilled && (
          <p className="text-sm text-white/45 text-center">
            {t(lang, "pick_n_more", 10 - filledCount)}
          </p>
        )}
        {!hasCast && allFilled && casting && (
          <p className="text-sm text-white/55 text-center">{t(lang, "submitting")}</p>
        )}
        {!hasCast && allFilled && autoCastFailed && (
          <button
            type="button"
            onClick={() => castVote(false)}
            disabled={casting}
            className="rainbow-border rounded-2xl w-full block disabled:opacity-40"
          >
            <span className="flex items-center justify-center gap-2 w-full h-14
                             rounded-[14px] bg-white text-dark-blue font-display text-lg">
              {casting ? t(lang, "submitting") : t(lang, "submit_12")}
            </span>
          </button>
        )}
        {hasCast && dirty && (
          <>
            <p className="text-xs text-gold/85 text-center">{t(lang, "vote_unsaved")}</p>
            <button
              type="button"
              onClick={() => castVote(true)}
              disabled={casting || !allFilled}
              className="rainbow-border rounded-2xl w-full block disabled:opacity-40"
            >
              <span className="flex items-center justify-center gap-2 w-full h-14
                               rounded-[14px] bg-white text-dark-blue font-display text-lg">
                {casting ? t(lang, "submitting") : (
                  <>
                    <Check className="h-4 w-4" />
                    {t(lang, "save_changes")}
                  </>
                )}
              </span>
            </button>
          </>
        )}
      </div>

      {/* Country picker for the ballot. The "options" list excludes
          countries already used elsewhere on the ballot, except for
          the country currently in the slot being edited (so swap is
          a no-op tap if you change your mind). */}
      <CountryDrawer
        title={pickingPoints != null ? t(lang, "ballot_pick_for", pickingPoints) : ""}
        sub={t(lang, "ballot_pick_hint")}
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

      {/* Auto-cast confirmation. Pops the instant all 10 slots are
          filled; from here the voter can jump to bonus bets or share
          their TOP10. Reordering after this just lights up the Save
          button at the bottom. */}
      <BottomSheet
        open={showCongrats}
        onClose={() => setShowCongrats(false)}
        title={t(lang, "vote_cast_title")}
        sub={t(lang, "vote_cast_body")}
      >
        <button
          type="button"
          onClick={() => {
            setShowCongrats(false);
            setTab("bets");
          }}
          className="rainbow-border rounded-2xl w-full block"
        >
          <span className="flex items-center justify-center gap-2 w-full py-3.5
                           rounded-[14px] bg-white text-dark-blue font-display text-base">
            <Sparkles className="h-4 w-4" />
            {t(lang, "vote_place_bets")}
          </span>
        </button>
        <button
          type="button"
          onClick={shareTop10}
          className="flex items-center justify-center gap-2 w-full rounded-2xl py-3.5
                     bg-white/[0.06] ring-1 ring-white/12 hover:bg-white/[0.1]
                     transition font-display text-base"
        >
          <Share2 className="h-4 w-4 text-white/70" />
          {t(lang, "share_picks")}
        </button>
        <button
          type="button"
          onClick={() => setShowCongrats(false)}
          className="text-sm text-white/45 hover:text-white/70 transition self-center pt-1"
        >
          {t(lang, "vote_keep_editing")}
        </button>
      </BottomSheet>
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

function RuleCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.04] ring-1 ring-white/8 px-4 py-3.5 flex flex-col gap-1">
      <p className="font-display text-sm text-white/90">{title}</p>
      <p className="text-sm text-white/60 leading-relaxed text-pretty">{body}</p>
    </div>
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
  // The top point values get a filled, gradient "douze points" chip;
  // the rest a quiet neutral one. The 12-row also gets a faint gold
  // wash once it's filled — it's the one everyone fights over.
  const isTop = slot.points === 12;
  const badgeClass =
    slot.points === 12
      ? "bg-gradient-to-br from-gold to-orange text-dark-blue shadow-[0_3px_10px_-3px_oklch(85%_0.16_85_/_0.6)]"
      : slot.points === 10
        ? "bg-gradient-to-br from-flamingo to-fuchsia text-white"
        : slot.points === 8
          ? "bg-gradient-to-br from-orange to-flamingo text-white"
          : "bg-white/[0.07] text-white/65 ring-1 ring-white/12";

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
      className={`group flex items-stretch rounded-2xl min-h-[4.75rem] transition
                  hover:ring-white/20
                  ${
                    country && isTop
                      ? "bg-gold/[0.07] ring-1 ring-gold/25"
                      : "bg-white/[0.04] ring-1 ring-white/8"
                  }`}
    >
      {/* Drag handle = the points chip + flag block on the left.
          @dnd-kit listeners attach here so the whole left side feels
          grabbable. The country text on the right is the tap-to-pick
          surface; X on the far right clears. */}
      <div
        {...attributes}
        {...listeners}
        role="button"
        aria-label={t(lang, "aria_drag_reorder")}
        className="flex items-center gap-3 pl-2.5 pr-1 py-3 cursor-grab
                   active:cursor-grabbing touch-none select-none"
      >
        <span
          className={`h-9 w-9 sm:h-10 sm:w-10 shrink-0 rounded-xl grid place-items-center
                      font-display text-lg tabular-nums leading-none ${badgeClass}`}
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
            // Dashed heart placeholder — exact same shape as the
            // heart-clipped flag SVGs in /public/flags so the empty
            // slot reads as "heart-flag waiting to be filled".
            <span
              data-slot-target={slot.points}
              className="shrink-0 inline-flex items-center justify-center text-white/35"
              aria-hidden
            >
              <HeartOutline size={36} />
            </span>
          )}
        </AnimatePresence>
      </div>

      <button
        type="button"
        onClick={onPick}
        className="flex flex-1 items-center gap-3 px-1 py-3 min-w-0 text-left
                   transition transform-gpu duration-150
                   active:scale-[0.99]"
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
                {countryName(country.code, lang)}
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
          aria-label={t(lang, "clear")}
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </li>
  );
}
