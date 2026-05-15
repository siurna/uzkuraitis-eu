"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { motion, AnimatePresence } from "motion/react";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDragDropBallot } from "@/lib/use-drag-drop-ballot";
import { bumpVibe } from "@/lib/use-vibe-tracker";
import { ListOrdered, Sparkles, Share2, ScrollText, GripVertical, Loader2 } from "lucide-react";
import { countries, getCountry, countryName } from "@/lib/countries";
import { Flag, HeartOutline } from "@/components/flag";
import { BonusBetsForm } from "@/components/bonus-bets-form";
import { SharePicks } from "@/components/share-picks";
import { CountryDrawer } from "@/components/country-drawer";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { useIdentity } from "@/lib/use-identity";
import { shareTopTen } from "@/lib/share-card";
import { HOST_COUNTRY, type Bets } from "@/lib/scoring";
import { t, fmt } from "@/lib/i18n";
import { useLang } from "@/lib/i18n-client";

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
  const [homePrediction, setHomePrediction] = useState<number | null>(null);
  const [bets, setBets] = useState<Bets>({});
  // Vote lifecycle. There's no submit button: the ballot auto-casts the
  // moment all 10 slots are full, and every later reorder / swap / bet
  // edit re-POSTs on a short debounce. `casting` guards overlapping
  // posts; `autoCastTried` makes the first auto-cast fire exactly once.
  const [hasCast, setHasCast] = useState(false);
  const [casting, setCasting] = useState(false);
  const [showCongrats, setShowCongrats] = useState(false);
  const [voterId, setVoterId] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  // Per-room sub-tab memory: persist the last ballot/bets/rules
  // pick so reopening the Vote tab feels native — same shape as
  // the room-level tab persistence in RoomShell.
  const [tab, _setTab] = useState<VoteTab>("ballot");
  const setTab = useCallback(
    (next: VoteTab) => {
      _setTab(next);
      try {
        localStorage.setItem(`uzk_vote_subtab_${roomCode}`, next);
      } catch {
        /* private mode */
      }
    },
    [roomCode],
  );
  // Which ballot slot is currently being edited via the country drawer.
  const [pickingPoints, setPickingPoints] = useState<Points | null>(null);
  // Slot that just got filled / moved into — gets a one-shot heartbeat
  // pulse. `flashedSlots` (owned by useDragDropBallot) are the rows a
  // drag shuffled past so they can flamingo-flash briefly.
  const [pulsingPoints, setPulsingPoints] = useState<Points | null>(null);

  const homeCountry = getCountry(homeCountryCode);
  const lang = useLang();

  const { sensors, onDragEnd, flashedSlots } = useDragDropBallot<Points>({
    slots,
    setSlots,
    setPulsingPoints,
  });

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
    if (storedPrediction) {
      const n = Number(storedPrediction);
      if (Number.isFinite(n)) setHomePrediction(n);
    }
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

  // Someone added a country to the ballot from elsewhere (the now-playing
  // chat card's "+ TOP 10") — re-read it so the open Vote tab reflects it.
  useEffect(() => {
    const reread = () => {
      try {
        const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY(roomCode)) ?? "null") as Slot[];
        if (Array.isArray(parsed) && parsed.length === 10) setSlots(parsed);
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("uzk:ballot-changed", reread);
    return () => window.removeEventListener("uzk:ballot-changed", reread);
  }, [roomCode]);

  // A Home banner deep-linked into a specific sub-tab (e.g. the Bonus
  // bets card → the Bets toggle).
  useEffect(() => {
    const onVoteTab = (e: Event) => {
      const sub = (e as CustomEvent).detail;
      if (sub === "ballot" || sub === "bets" || sub === "rules") setTab(sub);
    };
    window.addEventListener("uzk:vote-tab", onVoteTab);
    return () => window.removeEventListener("uzk:vote-tab", onVoteTab);
  }, [setTab]);

  // Restore last sub-tab on mount unless a deep-link already fired.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`uzk_vote_subtab_${roomCode}`);
      if (saved === "ballot" || saved === "bets" || saved === "rules") _setTab(saved);
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (homePrediction != null) {
      localStorage.setItem(PREDICTION_KEY(roomCode), String(homePrediction));
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

  // First cast: the moment all 10 slots are full (and we have a name),
  // POST the ballot — exactly once (the ref guards against the effect
  // re-firing while `hasCast` hasn't flipped yet, or after a failure).
  const autoCastTried = useRef(false);
  useEffect(() => {
    if (hasCast || casting || autoCastTried.current) return;
    if (!allFilled || !name.trim()) return;
    autoCastTried.current = true;
    void castVote(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allFilled, hasCast, casting, name]);

  // After the vote's been cast, every edit re-POSTs on a debounce — no
  // Save button. `saveArmed` swallows the render where the vote first
  // becomes cast (or is restored from localStorage) so it doesn't fire
  // a spurious re-save straight away.
  const saveArmed = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!hasCast) {
      saveArmed.current = false;
      return;
    }
    if (!saveArmed.current) {
      saveArmed.current = true;
      return;
    }
    if (!allFilled) return; // don't try to save an incomplete ballot
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void castVote(true), 1200);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasCast, allFilled, slots, bets, homePrediction]);

  const assign = (points: Points, code: string) => {
    // Drop the country into the slot, clearing it from any other slot it
    // was in, and give the row a one-shot heartbeat. (The flag's own
    // AnimatePresence scale-in does the rest — no fly-in particle.)
    setSlots((prev) =>
      prev.map((s) => {
        if (s.points === points) return { ...s, countryCode: code };
        if (s.countryCode === code) return { ...s, countryCode: null };
        return s;
      }),
    );
    setPulsingPoints(points);
    window.setTimeout(() => setPulsingPoints(null), 1100);
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
      const res = await fetch(`/api/rooms/${roomCode}/votes`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          sessionId: sessionId(),
          votes: ballot,
          homePrediction:
            homePrediction != null && Number.isFinite(homePrediction)
              ? homePrediction
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
      // First cast → the confirmation drawer (no toast on top). Later
      // auto-saves are silent. First cast also bumps the avatar
      // mood ring; subsequent updates don't (the meaningful action
      // is "I locked in", not the auto-save churn).
      if (!isUpdate) {
        setShowCongrats(true);
        bumpVibe("voteCast");
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setCasting(false);
    }
  };

  // Share the TOP10 card: fetch the rendered PNG, then hand it to the
  // native share sheet (mobile) or copy it to the clipboard (desktop).
  const share = async () => {
    if (!voterId || sharing || typeof window === "undefined") return;
    setSharing(true);
    try {
      const result = await shareTopTen({
        roomCode,
        voterId,
        caption: t(lang, "share_picks_caption"),
        lang,
      });
      if (result === "clipboard") toast.success(t(lang, "share_image_copied"));
    } catch {
      toast.error(t(lang, "share_failed"));
    } finally {
      setSharing(false);
    }
  };

  return (
    <main className="flex flex-col">
      <div className="container mx-auto max-w-3xl px-4 pt-5 pb-4 flex flex-col gap-5">
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
                <h2 className="font-display text-xl gradient-text px-1 text-balance">{t(lang, "your_top_10")}</h2>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                  <SortableContext items={slots.map((s) => `slot-${s.points}`)} strategy={verticalListSortingStrategy}>
                    <ul className="flex flex-col gap-2">
                      {slots.map((slot) => (
                        <BallotSlot
                          key={slot.points}
                          slot={slot}
                          onPick={() => setPickingPoints(slot.points)}
                          pulsing={pulsingPoints === slot.points}
                          flash={flashedSlots.has(slot.points)}
                        />
                      ))}
                    </ul>
                  </SortableContext>
                </DndContext>
                {!hasCast && !allFilled && (
                  <p className="text-sm text-white/45 text-center pt-1">
                    {t(lang, "pick_n_more", 10 - filledCount)}
                  </p>
                )}
                {!hasCast && allFilled && casting && (
                  <p className="text-sm text-white/55 text-center pt-1">{t(lang, "submitting")}</p>
                )}
                {hasCast && voterId && <SharePicks key={voterId} />}
              </section>
            )}

            {tab === "bets" && (
              <>
                {homeCountry && (
                  <section className="glass-card rounded-2xl p-4 sm:p-5 flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <Flag code={homeCountry.code} size="lg" />
                      <div className="flex-1 min-w-0">
                        <h2 className="font-display text-xl gradient-text text-balance">
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
                        value={homePrediction ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === "") {
                            setHomePrediction(null);
                            return;
                          }
                          const n = Number(v);
                          if (!Number.isFinite(n)) return;
                          setHomePrediction(Math.max(1, Math.min(countries.length, Math.round(n))));
                        }}
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

            {tab === "rules" && <RulesPanel homeCountryCode={homeCountryCode} lang={lang} />}
          </motion.div>
        </AnimatePresence>
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
          onClick={share}
          disabled={sharing}
          className="flex items-center justify-center gap-2 w-full rounded-2xl py-3.5
                     bg-white/[0.06] ring-1 ring-white/12 hover:bg-white/[0.1]
                     transition disabled:opacity-60 font-display text-base"
        >
          {sharing ? (
            <Loader2 className="h-4 w-4 animate-spin text-dark-blue-200" />
          ) : (
            <Share2 className="h-4 w-4 text-dark-blue-200" />
          )}
          {sharing ? t(lang, "share_preparing") : t(lang, "share_picks")}
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

// "places off → points" mini-ladder shown under the TOP10 and
// home-placement rules — a row of tiny dark chips, dim distance on the
// left, bright point value on the right.
function ScaleRow({ items }: { items: readonly (readonly [string, number])[] }) {
  return (
    <div className="flex flex-wrap gap-1.5 pt-1">
      {items.map(([off, pts]) => (
        <span
          key={off}
          className="inline-flex items-center gap-1 rounded-lg bg-black/30 ring-1 ring-white/10 px-2 py-1.5 text-[13px] leading-none"
        >
          <span className="text-white/40 tabular-nums">{off}</span>
          <span className="text-white/25">→</span>
          <span className="font-display text-white/90 tabular-nums">{pts}</span>
        </span>
      ))}
    </div>
  );
}

function RulesPanel({
  homeCountryCode,
  lang,
}: {
  homeCountryCode: string;
  lang: "en" | "lt";
}) {
  const home = countryName(homeCountryCode, lang);
  const host = countryName(HOST_COUNTRY, lang);
  const tr = (k: Parameters<typeof t>[1]) => fmt(t(lang, k), { home, host });

  // Bonus bets, biggest payouts first. `big` = a filled flamingo→fuchsia
  // chip (the headline +5 / closeness bets); the rest get a quiet chip.
  const bets: { label: string; sub: string; pts: string; big?: boolean }[] = [
    { label: tr("bet_lt_total"),        sub: tr("bet_lt_total_sub"),        pts: "0–10", big: true },
    { label: tr("bet_jury_winner"),     sub: tr("bet_jury_winner_sub"),     pts: "+5",   big: true },
    { label: tr("bet_televote_winner"), sub: tr("bet_televote_winner_sub"), pts: "+5",   big: true },
    { label: tr("bet_wooden_spoon"),    sub: tr("bet_wooden_spoon_sub"),    pts: "+5",   big: true },
    { label: tr("bet_lt_12_to"),        sub: tr("bet_lt_12_to_sub"),        pts: "+5",   big: true },
    { label: tr("bet_nul"),             sub: tr("bet_nul_sub"),             pts: "+4" },
    { label: tr("bet_big5"),            sub: tr("bet_big5_sub"),            pts: "+3" },
    { label: tr("bet_host_top3"),       sub: tr("bet_host_top3_sub"),       pts: "+3" },
    { label: tr("bet_solo_winner"),     sub: tr("bet_solo_winner_sub"),     pts: "+2" },
  ];

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-display text-xl gradient-text text-balance px-1">{t(lang, "rules_title")}</h2>

      {/* TOP 10 ballot */}
      <div className="rounded-2xl glass-surface px-4 py-4 flex flex-col gap-2.5">
        <p className="font-display text-base text-white/90">{t(lang, "rules_top10_h")}</p>
        <p className="text-[15px] text-white/65 leading-relaxed text-pretty">{t(lang, "rules_top10_b")}</p>
        <p className="text-[13px] text-white/45 leading-relaxed pt-0.5">{t(lang, "rules_top10_eg")}</p>
        <ScaleRow items={[["0", 12], ["1", 10], ["2", 8], ["3", 7], ["5", 5], ["9", 1]]} />
      </div>

      {/* Home-country placement */}
      <div className="rounded-2xl glass-surface px-4 py-4 flex flex-col gap-2.5">
        <p className="font-display text-base text-white/90">{t(lang, "rules_home_h")}</p>
        <p className="text-[15px] text-white/65 leading-relaxed text-pretty">{tr("rules_home_b")}</p>
        <ScaleRow items={[["0", 12], ["1", 10], ["2", 8], ["3", 7], ["5", 5], ["9", 1]]} />
      </div>

      {/* Bonus bets */}
      <div className="rounded-2xl glass-surface px-4 py-4 flex flex-col gap-3">
        <p className="font-display text-base text-white/90">{t(lang, "rules_bets_h")}</p>
        <p className="text-[13px] text-white/50 leading-relaxed">{t(lang, "rules_bets_intro")}</p>
        <ul className="flex flex-col">
          {bets.map((b) => (
            <li
              key={b.label}
              className="flex items-start gap-3 py-2.5 border-t border-white/8 first:border-t-0 first:pt-0 last:pb-0"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[15px] text-white/85 leading-snug">{b.label}</p>
                <p className="text-[13px] text-white/45 leading-snug mt-0.5 text-pretty">{b.sub}</p>
              </div>
              <span
                className={`shrink-0 mt-0.5 rounded-lg px-2 py-1 text-xs font-display tabular-nums leading-none ${
                  b.big
                    ? "bg-gradient-to-br from-flamingo to-fuchsia text-white"
                    : "bg-white/[0.07] ring-1 ring-white/12 text-white/80"
                }`}
              >
                {b.pts}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Chat highlights bonus */}
      <div className="rounded-2xl glass-surface px-4 py-4 flex flex-col gap-2">
        <p className="font-display text-base text-white/90">{t(lang, "breakdown_highlights")}</p>
        <p className="text-[15px] text-white/65 leading-relaxed text-pretty">{t(lang, "rules_highlights_b")}</p>
      </div>
    </section>
  );
}

function BallotSlot({
  slot,
  onPick,
  pulsing,
  flash,
}: {
  slot: Slot;
  onPick: () => void;
  pulsing: boolean;
  flash: boolean;
}) {
  const lang = useLang();
  return <BallotSlotInner slot={slot} onPick={onPick} pulsing={pulsing} flash={flash} lang={lang} />;
}

function BallotSlotInner({
  slot,
  onPick,
  pulsing,
  flash,
  lang,
}: {
  slot: Slot;
  onPick: () => void;
  pulsing: boolean;
  flash: boolean;
  lang: "en" | "lt";
}) {
  const id = `slot-${slot.points}`;
  // Empty slots aren't draggable — there's nothing to reorder until a
  // country lands in them, and a phantom drag handle on a placeholder
  // row just reads as broken.
  const draggable = !!slot.countryCode;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled: !draggable });

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
        // Kill the transform-transition while this row is the one under
        // the finger — otherwise every pointer move eases over ~200ms
        // and the drag feels laggy/floaty. Displaced rows keep it (the
        // smooth "make room" slide).
        transition: isDragging ? "none" : transition,
        opacity: isDragging ? 0.7 : 1,
        position: "relative",
        zIndex: isDragging ? 1 : undefined,
      }}
      // min-h pre-allocates the picked-state height so the row doesn't
      // jump taller the moment a country is chosen.
      className={`group flex items-stretch rounded-2xl min-h-[4.75rem] transition-colors duration-300
                  hover:ring-white/20
                  ${
                    flash
                      ? "bg-flamingo/[0.14] ring-1 ring-flamingo/45"
                      : country && isTop
                        ? "bg-gold/[0.07] ring-1 ring-gold/25"
                        : "glass-surface"
                  }`}
    >
      {/* Dedicated drag handle — small, touch-action:none so dnd-kit's
          hold-to-drag works, while the rest of the row stays freely
          scrollable + tappable. Hidden (but space kept) on empty rows. */}
      {draggable ? (
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={t(lang, "aria_drag_reorder")}
          className="shrink-0 flex items-center pl-1.5 pr-0.5 cursor-grab
                     active:cursor-grabbing touch-none text-white/25 hover:text-white/55 transition"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      ) : (
        <span className="shrink-0 flex items-center pl-1.5 pr-0.5 text-white/10" aria-hidden>
          <GripVertical className="h-4 w-4" />
        </span>
      )}

      <div className="flex items-center gap-3 pl-0.5 pr-1 py-3">
        <span
          className={`h-10 w-10 sm:h-11 sm:w-11 shrink-0 rounded-xl grid place-items-center
                      font-display text-xl tabular-nums leading-none pt-px ${badgeClass}`}
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
        aria-label={t(lang, "ballot_pick_for", slot.points)}
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
    </li>
  );
}
