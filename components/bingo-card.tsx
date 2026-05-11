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
import { toast } from "sonner";
import {
  useBroadcastEvent,
  useEventListener,
} from "@/lib/liveblocks";
import { useRoomLive } from "@/components/room-shell";
import { useIdentity } from "@/lib/use-identity";
import {
  buildBingoCard,
  FREE_SQUARE,
  getTrope,
  isBingo,
  TROPE_COUNT,
  tropeEmoji,
  tropeText,
  type TropeIndex,
} from "@/lib/bingo-tropes";
import { useLang, t } from "@/lib/i18n";

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

type Ticker = { id: number; by: string; trope: string; bingo: boolean };

// Hand-drawn "pen scribble" variants, drawn over a struck square. Each
// is a rough stroke in viewBox 0..100; we vary the path + pen colour by
// cell position so the page looks marked-up by an actual person, not a
// CSS line-through.
const SCRIBBLES = [
  "M16,24 C38,30 56,44 86,82 M82,22 C58,42 40,54 14,84",
  "M20,30 C8,56 30,82 56,72 C84,62 90,28 60,20 C34,12 24,40 42,62",
  "M14,82 C30,56 54,40 88,16 M28,86 C44,60 66,46 92,30",
  "M22,20 C50,32 60,60 30,82 M78,24 C52,40 40,66 70,86",
  "M18,50 C36,28 64,30 82,50 C68,72 36,74 18,50 M30,30 C30,30 70,70 70,70",
];
const PENS = ["#e63946", "#1d4ed8", "#0e7490", "#b91c1c", "#1a1a1a"];

export function BingoCard() {
  const { code } = useRoomLive();
  const lang = useLang();
  const broadcast = useBroadcastEvent();

  const { name, avatarId, sessionId } = useIdentity();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [active, setActive] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [scrambling, setScrambling] = useState(false);
  const [tickers, setTickers] = useState<Ticker[]>([]);

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
  }, [code]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(ticketKey(code), JSON.stringify(tickets));
    } catch {
      /* private mode */
    }
  }, [tickets, hydrated, code]);

  useEventListener(({ event }) => {
    const ev = event as { type?: string };
    if (ev.type !== "bingo:strike") return;
    const e = event as { by: string; trope: string; bingo?: boolean };
    setTickers((prev) =>
      [...prev, { id: Date.now() + Math.random(), by: e.by, trope: e.trope, bingo: !!e.bingo }].slice(-6),
    );
  });

  useEffect(() => {
    if (tickers.length === 0) return;
    const oldest = tickers[0];
    const timer = window.setTimeout(() => {
      setTickers((prev) => prev.filter((t) => t.id !== oldest.id));
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [tickers]);

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
          const trope = getTrope(tropeIdx, lang);
          broadcast({ type: "bingo:strike", by: name || "Someone", trope, bingo: wonNow });
          if (wonNow) {
            fetch(`/api/rooms/${code}/chat`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                session: sessionId(),
                name: name || "Anon",
                avatarId,
                kind: "bingo_strike",
                meta: { trope, bingo: true },
              }),
            }).catch(() => {});
            toast.success(t(lang, "bingo_you_did_it"));
          }
          return { ...tk, struck, bingoFired: tk.bingoFired || wonNow };
        }),
      );
    },
    [currentTicket, broadcast, name, lang, code],
  );

  const generate = useCallback(() => {
    const id = makeId();
    const seed = makeSeed();
    setScrambling(true);
    window.setTimeout(() => {
      setTickets((prev) => [...prev, { id, seed, struck: [] }]);
      setActive((prev) => prev + 1);
      setScrambling(false);
    }, 700);
  }, []);

  const remove = useCallback((id: string) => {
    setTickets((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((t) => t.id !== id);
    });
    setActive((a) => Math.max(0, a - 1));
  }, []);

  if (!hydrated || !currentTicket) {
    return (
      <main className="container mx-auto max-w-3xl px-4 py-6 flex-1">
        <div className="grid grid-cols-5 gap-1.5">
          {Array.from({ length: 25 }, (_, i) => (
            <div key={i} className="aspect-square rounded-2xl bg-white/5 animate-pulse" />
          ))}
        </div>
      </main>
    );
  }

  const struckCount = card.filter((tx) => tx === FREE_SQUARE || struckSet.has(tx)).length;

  return (
    <main className="container mx-auto max-w-3xl px-4 py-5 flex-1 flex flex-col gap-4">
      <header className="flex items-center gap-3">
        <h2 className="font-display text-2xl gradient-text flex-1 text-balance">
          {t(lang, "bingo_title")}
        </h2>
        <button
          type="button"
          onClick={generate}
          disabled={scrambling}
          className="rainbow-border rounded-2xl disabled:opacity-50"
          aria-label={t(lang, "bingo_generate")}
        >
          <span className="flex items-center gap-1.5 px-3 h-8 rounded-[12px] bg-white text-dark-blue font-display text-xs">
            <Plus className="h-3.5 w-3.5" />
            {t(lang, "bingo_generate")}
          </span>
        </button>
      </header>

      {/* Ticker (other voters' strikes) */}
      <div className="min-h-[20px]">
        <AnimatePresence initial={false}>
          {tickers.slice(-3).map((tk) => (
            <motion.p
              key={tk.id}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25 }}
              className={`text-xs leading-tight ${tk.bingo ? "text-flamingo" : "text-white/55"}`}
            >
              {tk.bingo ? (
                <>🎉 <span className="font-display">{tk.by}</span> — {t(lang, "bingo_won")} ({tk.trope})</>
              ) : (
                <><span className="font-display">{tk.by}</span> → {tk.trope}</>
              )}
            </motion.p>
          ))}
        </AnimatePresence>
      </div>

      {/* Ticket switcher */}
      {tickets.length > 1 && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={active === 0}
            onClick={() => setActive((a) => Math.max(0, a - 1))}
            className="h-9 w-9 rounded-full grid place-items-center bg-white/[0.04] ring-1 ring-white/10 disabled:opacity-30 hover:bg-white/[0.08] transition"
            aria-label="Previous ticket"
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
            className="h-9 w-9 rounded-full grid place-items-center bg-white/[0.04] ring-1 ring-white/10 disabled:opacity-30 hover:bg-white/[0.08] transition"
            aria-label="Next ticket"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Emoji grid — the "card". Just emoji; a scribble lands when struck. */}
      <div className="relative overflow-hidden">
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
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
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

      {tickets.length > 1 && (
        <button
          type="button"
          onClick={() => remove(currentTicket.id)}
          className="self-center text-xs text-white/40 hover:text-error transition"
        >
          {t(lang, "bingo_remove_ticket")}
        </button>
      )}

      {/* The readable list — full trope text, checklist style. Tapping a
          row toggles the same square. Mobile-readable, unlike 10px text
          crammed into a tile. */}
      <section className="flex flex-col gap-2 pt-1">
        <div className="flex items-baseline justify-between gap-3 px-1">
          <h3 className="font-display text-sm uppercase tracking-[0.18em] text-white/55">
            {t(lang, "bingo_list")}
          </h3>
          <span className="text-xs text-white/40 tabular-nums">{struckCount} / 25</span>
        </div>
        <ol className="flex flex-col gap-1.5">
          {card.map((tropeIdx, i) => {
            const isFree = tropeIdx === FREE_SQUARE;
            const isStruck = isFree || struckSet.has(tropeIdx);
            return (
              <li key={`row-${currentTicket.id}-${i}`}>
                <button
                  type="button"
                  disabled={isFree}
                  onClick={() => toggle(tropeIdx)}
                  className={`group flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition
                              ${
                                isStruck
                                  ? "bg-flamingo/10 ring-1 ring-flamingo/25"
                                  : "bg-white/[0.04] ring-1 ring-white/8 hover:bg-white/[0.07]"
                              } ${isFree ? "cursor-default" : ""}`}
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
                  <span className="text-lg shrink-0 leading-none">
                    {isFree ? "❤️" : tropeEmoji(tropeIdx)}
                  </span>
                  <span
                    className={`text-sm leading-snug ${
                      isStruck ? "text-white/45 line-through decoration-flamingo/60" : "text-white/85"
                    }`}
                  >
                    {isFree ? t(lang, "bingo_free") : tropeText(tropeIdx, lang)}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </section>

      <p className="text-xs text-white/40 text-center pt-1 text-balance">{t(lang, "bingo_footer")}</p>
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
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!scrambling) {
      setScrambleEmoji(null);
      if (timer.current) clearInterval(timer.current);
      return;
    }
    timer.current = setInterval(() => {
      const j = Math.floor(Math.random() * TROPE_COUNT);
      setScrambleEmoji(tropeEmoji(j));
    }, 90);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [scrambling]);

  const scribble = SCRIBBLES[index % SCRIBBLES.length];
  const pen = PENS[(index * 3 + 1) % PENS.length];
  const shown = scrambling && scrambleEmoji ? scrambleEmoji : emoji;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-pressed={isStruck}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.22, delay: index * 0.012, ease: [0.22, 1, 0.36, 1] }}
      className={`relative aspect-square rounded-2xl grid place-items-center
                  text-2xl sm:text-3xl select-none
                  transition transform-gpu duration-150 active:scale-[0.95] focus-visible:outline-none
                  ${
                    isFree
                      ? "bg-flamingo/15 ring-1 ring-flamingo/40"
                      : isStruck
                        ? "bg-white/[0.05] ring-1 ring-white/12"
                        : "bg-white/[0.04] ring-1 ring-white/10 hover:bg-white/[0.08]"
                  }`}
    >
      <span className={isStruck ? "opacity-90" : ""}>{shown}</span>

      {/* Hand-drawn pen scribble over a struck square. */}
      <AnimatePresence>
        {isStruck && (
          <motion.svg
            key="scribble"
            viewBox="0 0 100 100"
            className="pointer-events-none absolute inset-0 h-full w-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.path
              d={scribble}
              fill="none"
              stroke={pen}
              strokeWidth={7}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={isFree ? { pathLength: 1 } : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.38, ease: "easeOut" }}
              style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.35))" }}
            />
          </motion.svg>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
