"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { useRoomLive } from "@/components/room-shell";
import { FluentEmoji } from "@/components/fluent-emoji";
import { useIdentity } from "@/lib/use-identity";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import {
  buildBingoCard,
  FREE_SQUARE,
  isBingo,
  TROPE_COUNT,
  tropeEmoji,
  tropeText,
  type TropeIndex,
} from "@/lib/bingo-tropes";
import { t } from "@/lib/i18n";
import { useLang } from "@/lib/i18n-client";

type Ticket = {
  id: string;
  seed: string;
  struck: number[];
  bingoFired?: boolean;
};

function ticketKey(code: string): string {
  return `uzk_bingo_tickets_${code}`;
}
function makeId(): string {
  return `t_${Math.random().toString(36).slice(2, 10)}`;
}
function makeSeed(): string {
  return Math.random().toString(36).slice(2, 14);
}

// One consistent strike mark: a clean X drawn in the brand rainbow.
// The gradient is defined once (hidden <svg> at the top) and every
// cell's X references it via stroke="url(#bingo-x)".
const X_PATH = "M24 24 L76 76 M76 24 L24 76";

// Keep the deck small — three cards is plenty to follow, and the home
// progress widget would get noisy beyond that.
const MAX_TICKETS = 3;

export function BingoCard() {
  const { code } = useRoomLive();
  const lang = useLang();
  const { name, avatarId, sessionId } = useIdentity();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [active, setActive] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [scrambling, setScrambling] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);

  useEffect(() => {
    const session = sessionId();
    try {
      const stored = JSON.parse(localStorage.getItem(ticketKey(code)) ?? "[]");
      if (Array.isArray(stored) && stored.length > 0) {
        setTickets(stored as Ticket[]);
      } else {
        const oldStruck = JSON.parse(
          localStorage.getItem(`uzk_bingo_struck_${code}`) ?? "[]",
        ) as number[];
        setTickets([
          { id: makeId(), seed: session, struck: Array.isArray(oldStruck) ? oldStruck : [] },
        ]);
      }
    } catch {
      setTickets([{ id: makeId(), seed: session, struck: [] }]);
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(ticketKey(code), JSON.stringify(tickets));
    } catch {
      /* private mode */
    }
  }, [tickets, hydrated, code]);

  const currentTicket = tickets[active] ?? null;
  const card = useMemo(
    () => (currentTicket ? buildBingoCard(currentTicket.seed) : Array(25).fill(FREE_SQUARE)),
    [currentTicket],
  );
  const struckSet = useMemo(() => new Set(currentTicket?.struck ?? []), [currentTicket]);

  const toggle = useCallback(
    (tropeIdx: TropeIndex) => {
      if (!currentTicket || tropeIdx === FREE_SQUARE) return;
      setTickets((prev) =>
        prev.map((tk) => {
          if (tk.id !== currentTicket.id) return tk;
          const has = tk.struck.includes(tropeIdx);
          const struck = has
            ? tk.struck.filter((x) => x !== tropeIdx)
            : [...tk.struck, tropeIdx];
          if (has) return { ...tk, struck };

          const wonNow = !tk.bingoFired && isBingo(buildBingoCard(tk.seed), new Set(struck));
          if (wonNow) {
            // Store the trope *index* — the chat renders it in each
            // recipient's own language.
            fetch(`/api/rooms/${code}/chat`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                session: sessionId(),
                name: name || "Anon",
                avatarId,
                kind: "bingo_strike",
                meta: { tropeIndex: tropeIdx, bingo: true },
              }),
            }).catch(() => {});
            // No toast — the confetti animation + the bingo-strike
            // broadcast that lands in chat carry the moment.
          }
          return { ...tk, struck, bingoFired: tk.bingoFired || wonNow };
        }),
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentTicket, name, avatarId, code],
  );

  const generate = useCallback(() => {
    if (tickets.length >= MAX_TICKETS) return;
    // Add a new (empty) ticket, flip to it, scroll the freshly-spawned
    // card into view, then run the scramble — the cells go "?" → spin →
    // lock left-to-right / top-to-bottom so it reads as "filling up".
    const id = makeId();
    const seed = makeSeed();
    setTickets((prev) => [...prev, { id, seed, struck: [] }]);
    setActive((prev) => prev + 1);
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    setScrambling(true);
    window.setTimeout(() => setScrambling(false), 1800);
  }, [tickets.length]);

  const remove = useCallback((id: string) => {
    setTickets((prev) => (prev.length <= 1 ? prev : prev.filter((t) => t.id !== id)));
    setActive((a) => Math.max(0, a - 1));
    setRemoveOpen(false);
  }, []);

  if (!hydrated || !currentTicket) {
    return (
      <main className="container mx-auto max-w-3xl px-4 py-6 flex-1">
        <div className="grid grid-cols-5 gap-1.5">
          {Array.from({ length: 25 }, (_, i) => (
            <div key={i} className="aspect-square rounded-2xl bg-white/5 skeleton" />
          ))}
        </div>
      </main>
    );
  }

  const struckCount = card.filter((tx) => tx === FREE_SQUARE || struckSet.has(tx)).length;

  return (
    // No pt on <main> — the pt now lives inside the ticket wrapper so
    // the same visual breathing room above the grid is also "inside"
    // the wrapper, where the cells' ring overflow has room to render
    // without getting shaved by the fixed-header overlap on entry.
    <main className="container mx-auto max-w-3xl px-4 pb-10 flex-1 flex flex-col gap-3">
      {/* Brand-rainbow stroke for the strike X, defined once. */}
      <svg width={0} height={0} className="absolute -z-10" aria-hidden>
        <defs>
          <linearGradient id="bingo-x" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#f10d59" />
            <stop offset="0.24" stopColor="#ff3ede" />
            <stop offset="0.95" stopColor="#00d4cc" />
          </linearGradient>
        </defs>
      </svg>

      {/* The card. The wrapper clips the ticket slide-in/out sideways;
          the small -mx-2 px-2 gives the tiles' rings room so the edge
          tiles aren't shaved by the clip. pt-4 inside the wrapper
          (not on <main>) puts the breathing room *under* the clip
          boundary so the top tiles' rings never get cut. */}
      <div className="relative overflow-x-clip -mx-2 px-2 pt-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentTicket.id}
            drag={tickets.length > 1 ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.18}
            onDragEnd={(_, info) => {
              if (info.offset.x < -60 && active < tickets.length - 1) setActive(active + 1);
              else if (info.offset.x > 60 && active > 0) setActive(active - 1);
            }}
            initial={{ opacity: 0, x: 36 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -36 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="grid grid-cols-5 gap-1.5 sm:gap-2 touch-pan-y"
          >
            {card.map((tropeIdx, i) => {
              const isFree = tropeIdx === FREE_SQUARE;
              const isStruck = isFree || struckSet.has(tropeIdx);
              return (
                <Cell
                  key={`${currentTicket.id}-${i}`}
                  index={i}
                  scrambling={scrambling}
                  emoji={isFree ? "❤️" : tropeEmoji(tropeIdx)}
                  isFree={isFree}
                  isStruck={isStruck}
                  onClick={() => toggle(tropeIdx)}
                />
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Ticket switcher — sits between the grid and the list. */}
      {tickets.length > 1 && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={active === 0}
            onClick={() => setActive((a) => Math.max(0, a - 1))}
            className="h-8 w-8 rounded-full grid place-items-center bg-white/[0.04] ring-1 ring-white/10 disabled:opacity-30 hover:bg-white/[0.08] transition"
            aria-label={t(lang, "back")}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex-1 text-center text-[11px] uppercase tracking-[0.24em] text-white/55 font-display">
            {t(lang, "bingo_ticket")} {active + 1} / {tickets.length}
          </div>
          <button
            type="button"
            disabled={active >= tickets.length - 1}
            onClick={() => setActive((a) => Math.min(tickets.length - 1, a + 1))}
            className="h-8 w-8 rounded-full grid place-items-center bg-white/[0.04] ring-1 ring-white/10 disabled:opacity-30 hover:bg-white/[0.08] transition"
            aria-label={t(lang, "next")}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* The readable list — full trope text, checklist style. Tapping a
          row toggles the same square. */}
      <section className="flex flex-col gap-2 pt-1">
        <div className="flex items-baseline justify-between gap-3 px-1">
          <h3 className="font-display text-sm uppercase tracking-[0.18em] text-white/55">
            {t(lang, "bingo_list")}
          </h3>
          <span className="text-xs text-white/40 tabular-nums">{struckCount} / 25</span>
        </div>
        <ol className="flex flex-col gap-1.5">
          {card
            .map((tropeIdx, i) => ({ tropeIdx, i }))
            .filter((c) => c.tropeIdx !== FREE_SQUARE)
            .map(({ tropeIdx, i }) => {
              const isStruck = struckSet.has(tropeIdx);
              return (
                <li key={`row-${currentTicket.id}-${i}`}>
                  <button
                    type="button"
                    onClick={() => toggle(tropeIdx)}
                    className={`group flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition
                                ${
                                  isStruck
                                    ? "bg-flamingo/10 ring-1 ring-flamingo/25"
                                    : "glass-surface hover:bg-white/[0.07]"
                                }`}
                  >
                    <span
                      className={`h-5 w-5 shrink-0 rounded-md grid place-items-center transition
                                  ${
                                    isStruck
                                      ? "bg-flamingo text-white"
                                      : "ring-1 ring-white/25 text-transparent group-hover:ring-white/40"
                                  }`}
                    >
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                    <span className="shrink-0">
                      <FluentEmoji glyph={tropeEmoji(tropeIdx)} size={22} />
                    </span>
                    <span
                      className={`text-sm leading-snug ${
                        isStruck ? "text-white/45 line-through decoration-flamingo/60" : "text-white/85"
                      }`}
                    >
                      {tropeText(tropeIdx, lang)}
                    </span>
                  </button>
                </li>
              );
            })}
        </ol>
      </section>

      {/* Ticket actions live at the bottom, under the list. */}
      <div className="flex items-center justify-center gap-3 pt-3">
        <button
          type="button"
          onClick={generate}
          disabled={scrambling || tickets.length >= MAX_TICKETS}
          className="rainbow-border rounded-2xl disabled:opacity-50"
          aria-label={t(lang, "bingo_generate")}
        >
          <span className="flex items-center gap-1.5 px-3.5 h-9 rounded-[14px] bg-white text-dark-blue font-display text-xs">
            {tickets.length >= MAX_TICKETS ? (
              <span className="tabular-nums">{tickets.length} / {MAX_TICKETS}</span>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5" />
                {t(lang, "bingo_generate")}
              </>
            )}
          </span>
        </button>
        {tickets.length > 1 && (
          <button
            type="button"
            onClick={() => setRemoveOpen(true)}
            className="px-3.5 h-9 rounded-2xl text-xs text-white/45 hover:text-error hover:bg-error/10 transition"
          >
            {t(lang, "bingo_remove_ticket")}
          </button>
        )}
      </div>

      {/* Delete-ticket confirmation. */}
      <BottomSheet
        open={removeOpen}
        onClose={() => setRemoveOpen(false)}
        title={t(lang, "bingo_remove_confirm")}
        sub={t(lang, "bingo_remove_confirm_sub")}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setRemoveOpen(false)} className="text-white/70">
              {t(lang, "cancel")}
            </Button>
            <div className="flex-1" />
            <Button
              type="button"
              onClick={() => remove(currentTicket.id)}
              className="bg-error text-white hover:bg-error/90 rounded-2xl"
            >
              {t(lang, "bingo_remove_ticket")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-white/60 leading-relaxed">{t(lang, "bingo_remove_confirm_body")}</p>
      </BottomSheet>
    </main>
  );
}

function Cell({
  index,
  scrambling,
  emoji,
  isFree,
  isStruck,
  onClick,
}: {
  index: number;
  scrambling: boolean;
  emoji: string;
  isFree: boolean;
  isStruck: boolean;
  onClick: () => void;
}) {
  const [scrambleEmoji, setScrambleEmoji] = useState<string | null>(null);
  const [locked, setLocked] = useState(true);
  const interval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const clear = () => {
      if (interval.current) clearInterval(interval.current);
      interval.current = null;
    };
    if (!scrambling || isFree) {
      clear();
      setScrambleEmoji(null);
      setLocked(true);
      return;
    }
    setLocked(false);
    setScrambleEmoji(null);
    const startSpin = 200 + index * 26;
    const lockAt = 560 + index * 48;
    const t1 = setTimeout(() => {
      interval.current = setInterval(() => {
        setScrambleEmoji(tropeEmoji(Math.floor(Math.random() * TROPE_COUNT)));
      }, 75);
    }, startSpin);
    const t2 = setTimeout(() => {
      clear();
      setLocked(true);
    }, lockAt);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clear();
    };
  }, [scrambling, isFree, index]);

  const shown = locked ? emoji : scrambleEmoji ?? "?";

  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-pressed={isStruck}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.22, delay: index * 0.012, ease: [0.22, 1, 0.36, 1] }}
      className={`relative aspect-square rounded-2xl grid place-items-center
                  text-[1.7rem] sm:text-4xl select-none
                  transition-colors transform-gpu duration-150 active:scale-[0.95] focus-visible:outline-none
                  ${
                    isFree
                      ? "bg-flamingo/15 ring-1 ring-flamingo/40"
                      : isStruck
                        ? "bg-white/[0.05] ring-1 ring-white/12"
                        : "bg-white/[0.04] ring-1 ring-white/10 hover:bg-white/[0.08]"
                  }`}
    >
      {isFree ? (
        // The brand heart sits in the centre square — never crossed out.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/images/70-heart-2x.webp"
          alt=""
          className="h-[68%] w-[68%] object-contain heartbeat-loop"
        />
      ) : (
        <span className={isStruck ? "opacity-40 grayscale" : ""}>
          <FluentEmoji glyph={shown} size={44} />
        </span>
      )}

      {/* The single rainbow X over a struck square (centre square exempt). */}
      <AnimatePresence>
        {isStruck && !isFree && (
          <motion.svg
            key="x"
            viewBox="0 0 100 100"
            className="pointer-events-none absolute inset-0 h-full w-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.path
              d={X_PATH}
              fill="none"
              stroke="url(#bingo-x)"
              strokeWidth={9}
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.45))" }}
            />
          </motion.svg>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
