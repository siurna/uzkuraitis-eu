"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  Heart,
  Plus,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import {
  useBroadcastEvent,
  useEventListener,
} from "@/lib/liveblocks";
import { useRoomLive } from "@/components/room-shell";
import {
  buildBingoCard,
  FREE_SQUARE,
  getTrope,
  isBingo,
  TROPE_COUNT,
  type TropeIndex,
} from "@/lib/bingo-tropes";
import { useLang, t } from "@/lib/i18n";

const SESSION_KEY = "uzk_session";
const NAME_KEY = "uzk_name";
const AVATAR_KEY = "uzk_avatar";

// One voter may keep multiple tickets — handy when the first ticket
// stalls or for sharing a fresh card with someone next to you. Each
// ticket has its own seed + struck set so the layout is stable across
// reloads.
type Ticket = {
  id: string;
  /** Deterministic seed for buildBingoCard — same seed = same layout. */
  seed: string;
  /** Indices of struck tropes (NOT cell positions). FREE auto-strikes. */
  struck: number[];
  /** Whether the player has already triggered the bingo broadcast on this
   *  ticket (so we don't re-fire on subsequent strikes). */
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

export function BingoCard() {
  const { code } = useRoomLive();
  const lang = useLang();
  const broadcast = useBroadcastEvent();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [active, setActive] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [scrambling, setScrambling] = useState(false);
  const [name, setName] = useState("");
  const [tickers, setTickers] = useState<Ticker[]>([]);

  // Hydrate tickets from localStorage. First-time visitors get one
  // deterministic ticket seeded by their session id (same UX as v1).
  useEffect(() => {
    let session = localStorage.getItem(SESSION_KEY);
    if (!session) {
      session = `s_${Math.random().toString(36).slice(2, 14)}`;
      localStorage.setItem(SESSION_KEY, session);
    }
    setName(localStorage.getItem(NAME_KEY) ?? "");
    try {
      const stored = JSON.parse(localStorage.getItem(ticketKey(code)) ?? "[]");
      if (Array.isArray(stored) && stored.length > 0) {
        setTickets(stored as Ticket[]);
      } else {
        // Backwards-compat: lift the old single-card struck list, if any.
        const oldStruck = JSON.parse(
          localStorage.getItem(`uzk_bingo_struck_${code}`) ?? "[]",
        ) as number[];
        setTickets([
          {
            id: makeId(),
            seed: session,
            struck: Array.isArray(oldStruck) ? oldStruck : [],
          },
        ]);
      }
    } catch {
      setTickets([{ id: makeId(), seed: session, struck: [] }]);
    }
    setHydrated(true);
  }, [code]);

  // Persist whenever tickets change.
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(ticketKey(code), JSON.stringify(tickets));
    } catch {
      /* private mode */
    }
  }, [tickets, hydrated, code]);

  // Other voters' strikes → ticker.
  useEventListener(({ event }) => {
    const ev = event as { type?: string };
    if (ev.type !== "bingo:strike") return;
    const e = event as { by: string; trope: string; bingo?: boolean };
    setTickers((prev) =>
      [
        ...prev,
        { id: Date.now() + Math.random(), by: e.by, trope: e.trope, bingo: !!e.bingo },
      ].slice(-6),
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
    () =>
      currentTicket
        ? buildBingoCard(currentTicket.seed)
        : Array(25).fill(FREE_SQUARE),
    [currentTicket],
  );
  const struckSet = useMemo(
    () => new Set(currentTicket?.struck ?? []),
    [currentTicket],
  );

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

          const wonNow =
            !tk.bingoFired && isBingo(buildBingoCard(tk.seed), new Set(struck));
          const trope = getTrope(tropeIdx, lang);
          broadcast({
            type: "bingo:strike",
            by: name || "Someone",
            trope,
            bingo: wonNow,
          });
          if (wonNow) {
            // Drop a bingo card into chat so the thread carries the moment.
            const session = localStorage.getItem(SESSION_KEY) ?? "";
            const avatarId = localStorage.getItem(AVATAR_KEY);
            fetch(`/api/rooms/${code}/chat`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                session,
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
    // Scramble animation: pretend to shuffle for ~700ms, then settle
    // on the new ticket. The actual layout is computed once.
    const id = makeId();
    const seed = makeSeed();
    setScrambling(true);
    window.setTimeout(() => {
      setTickets((prev) => [...prev, { id, seed, struck: [] }]);
      setActive((prev) => prev + 1);
      // Wait one more frame so the new card is the one we settle on.
      setScrambling(false);
    }, 700);
  }, []);

  const remove = useCallback(
    (id: string) => {
      setTickets((prev) => {
        if (prev.length <= 1) return prev;
        const next = prev.filter((t) => t.id !== id);
        return next;
      });
      setActive((a) => Math.max(0, a - 1));
    },
    [],
  );

  if (!hydrated || !currentTicket) {
    return (
      <main className="container mx-auto max-w-3xl px-4 py-6 flex-1">
        <div className="grid grid-cols-5 gap-1.5">
          {Array.from({ length: 25 }, (_, i) => (
            <div
              key={i}
              className="aspect-square rounded-xl bg-white/5 animate-pulse"
            />
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="container mx-auto max-w-3xl px-4 py-5 flex-1 flex flex-col gap-4">
      <header className="flex items-center gap-3">
        <h2 className="font-display text-2xl gradient-text flex-1">
          {t(lang, "bingo_title")}
        </h2>
        <button
          type="button"
          onClick={generate}
          disabled={scrambling}
          className="rainbow-border rounded-2xl disabled:opacity-50"
          aria-label={t(lang, "bingo_generate")}
        >
          <span className="flex items-center gap-1.5 px-3 h-8 rounded-[12px]
                           bg-white text-dark-blue font-display text-xs">
            <Plus className="h-3.5 w-3.5" />
            {t(lang, "bingo_generate")}
          </span>
        </button>
      </header>

      {/* Ticker (last 3 other-voter strikes) */}
      <div className="min-h-[24px]">
        <AnimatePresence initial={false}>
          {tickers.slice(-3).map((tk) => (
            <motion.p
              key={tk.id}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25 }}
              className={`text-xs leading-tight ${
                tk.bingo ? "text-flamingo" : "text-white/55"
              }`}
            >
              {tk.bingo ? (
                <>
                  🎉 <span className="font-display">{tk.by}</span> —{" "}
                  {t(lang, "bingo_won")} ({tk.trope})
                </>
              ) : (
                <>
                  <span className="font-display">{tk.by}</span> → {tk.trope}
                </>
              )}
            </motion.p>
          ))}
        </AnimatePresence>
      </div>

      {/* Ticket carousel — swipeable, plus arrow buttons. */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={active === 0}
          onClick={() => setActive((a) => Math.max(0, a - 1))}
          className="h-9 w-9 rounded-full grid place-items-center
                     bg-white/[0.04] ring-1 ring-white/10
                     disabled:opacity-30 hover:bg-white/[0.08] transition"
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
          onClick={() =>
            setActive((a) => Math.min(tickets.length - 1, a + 1))
          }
          className="h-9 w-9 rounded-full grid place-items-center
                     bg-white/[0.04] ring-1 ring-white/10
                     disabled:opacity-30 hover:bg-white/[0.08] transition"
          aria-label="Next ticket"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Drag-x carousel of grids. AnimatePresence with mode="popLayout"
          so the new card flies in from the right. */}
      <div className="relative overflow-hidden">
        <AnimatePresence mode="wait" custom={active}>
          <motion.div
            key={currentTicket.id}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.18}
            onDragEnd={(_, info) => {
              if (info.offset.x < -60 && active < tickets.length - 1) {
                setActive(active + 1);
              } else if (info.offset.x > 60 && active > 0) {
                setActive(active - 1);
              }
            }}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="grid grid-cols-5 gap-1.5 touch-pan-y"
          >
            {card.map((tropeIdx, i) => {
              const isFree = tropeIdx === FREE_SQUARE;
              const isStruck = isFree || struckSet.has(tropeIdx);
              return (
                <Cell
                  key={`${currentTicket.id}-${i}`}
                  index={i}
                  scrambling={scrambling}
                  tropeIdx={tropeIdx}
                  isFree={isFree}
                  isStruck={isStruck}
                  label={isFree ? t(lang, "bingo_free") : getTrope(tropeIdx, lang)}
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

      <p className="text-xs text-white/40 text-center pt-1">
        {t(lang, "bingo_footer")}
      </p>
    </main>
  );
}

function Cell({
  index,
  scrambling,
  tropeIdx,
  isFree,
  isStruck,
  label,
  onClick,
}: {
  index: number;
  scrambling: boolean;
  tropeIdx: TropeIndex;
  isFree: boolean;
  isStruck: boolean;
  label: string;
  onClick: () => void;
}) {
  // Brief scramble: each cell cycles through a couple of random trope
  // indices for ~600ms, then settles on its real value. Pure visual —
  // doesn't change state.
  const [scrambled, setScrambled] = useState<number | null>(null);
  const scrambleTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!scrambling) {
      setScrambled(null);
      if (scrambleTimer.current) clearInterval(scrambleTimer.current);
      return;
    }
    scrambleTimer.current = setInterval(() => {
      setScrambled(Math.floor(Math.random() * TROPE_COUNT));
    }, 90);
    return () => {
      if (scrambleTimer.current) clearInterval(scrambleTimer.current);
    };
  }, [scrambling]);

  const display = scrambling && scrambled != null
    ? scrambled
    : tropeIdx;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-pressed={isStruck}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        duration: 0.22,
        delay: index * 0.012,
        ease: [0.22, 1, 0.36, 1],
      }}
      className={`relative aspect-square rounded-xl px-1.5 py-2 text-[10px]
                  leading-tight text-center font-display
                  flex items-center justify-center
                  transition transform-gpu duration-150
                  active:scale-[0.96] focus-visible:outline-none
                  ${
                    isFree
                      ? "bg-flamingo/20 ring-1 ring-flamingo/50 text-white"
                      : isStruck
                        ? "bg-flamingo/15 ring-1 ring-flamingo/40 text-white/70 line-through decoration-flamingo decoration-2"
                        : "bg-white/[0.04] ring-1 ring-white/10 hover:bg-white/[0.08] text-white/85"
                  }`}
    >
      <span className="overflow-hidden text-balance">
        {isFree ? (
          <span className="flex flex-col items-center gap-0.5 text-flamingo">
            <Heart className="h-4 w-4" fill="currentColor" strokeWidth={1.5} />
            {label}
          </span>
        ) : scrambling ? (
          <span className="opacity-80">
            {getTrope(typeof display === "number" ? display : 0, "en")}
          </span>
        ) : (
          label
        )}
      </span>
    </motion.button>
  );
}
