"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, Heart, RotateCcw } from "lucide-react";
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
  type TropeIndex,
} from "@/lib/bingo-tropes";
import { useLang, t } from "@/lib/i18n";

const SESSION_KEY = "uzk_session";
const NAME_KEY = "uzk_name";
const AVATAR_KEY = "uzk_avatar";

// Per-room striked tropes (set of trope indices) persist in localStorage
// so strikes survive reloads. Card itself is deterministic from the
// session — same browser = same card.
function strikeKey(code: string): string {
  return `uzk_bingo_struck_${code}`;
}

// Recent strikes from other voters, shown as a quiet ticker above the
// card. Each entry is auto-purged after a few seconds.
type Ticker = { id: number; by: string; trope: string; bingo: boolean };

export function BingoCard() {
  const { code } = useRoomLive();
  const lang = useLang();
  const broadcast = useBroadcastEvent();

  const [session, setSession] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [struck, setStruck] = useState<Set<TropeIndex>>(new Set());
  const [tickers, setTickers] = useState<Ticker[]>([]);
  const [didBingo, setDidBingo] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let s = localStorage.getItem(SESSION_KEY);
    if (!s) {
      // The vote flow generates this; if the user lands on bingo first
      // we lazy-init the session here.
      s = `s_${Math.random().toString(36).slice(2, 14)}`;
      localStorage.setItem(SESSION_KEY, s);
    }
    setSession(s);
    setName(localStorage.getItem(NAME_KEY) ?? "");
    try {
      const stored = JSON.parse(localStorage.getItem(strikeKey(code)) ?? "[]");
      if (Array.isArray(stored)) setStruck(new Set(stored as number[]));
    } catch {
      /* invalid blob, start fresh */
    }
    setHydrated(true);
  }, [code]);

  // Card is stable for the lifetime of the session.
  const card = useMemo(
    () => (session ? buildBingoCard(session) : Array(25).fill(FREE_SQUARE)),
    [session],
  );

  // Persist strikes whenever they change.
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(strikeKey(code), JSON.stringify(Array.from(struck)));
    } catch {
      /* private mode */
    }
  }, [struck, code, hydrated]);

  // Pull other voters' strikes into the ticker.
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

  // Tickers fade after 5 s.
  useEffect(() => {
    if (tickers.length === 0) return;
    const oldest = tickers[0];
    const timer = window.setTimeout(() => {
      setTickers((prev) => prev.filter((t) => t.id !== oldest.id));
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [tickers]);

  const toggle = useCallback(
    (tropeIdx: TropeIndex) => {
      if (tropeIdx === FREE_SQUARE) return;
      setStruck((prev) => {
        const next = new Set(prev);
        const isStriking = !next.has(tropeIdx);
        if (isStriking) {
          next.add(tropeIdx);
          const bingoNow = isBingo(card, next);
          const trope = getTrope(tropeIdx, lang);
          // Broadcast each strike (not un-strike — uncrossing isn't
          // a moment worth telling the room about).
          broadcast({
            type: "bingo:strike",
            by: name || "Someone",
            trope,
            bingo: bingoNow,
          });
          // Drop a card-style message into the chat so the thread
          // carries the moment. Only winning strikes by default —
          // every single cross would spam the channel.
          if (bingoNow) {
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
          }
          if (bingoNow && !didBingo) {
            setDidBingo(true);
            toast.success(t(lang, "bingo_you_did_it"));
          }
        } else {
          next.delete(tropeIdx);
        }
        return next;
      });
    },
    [card, broadcast, name, lang, didBingo, code],
  );

  const reset = () => {
    setStruck(new Set());
    setDidBingo(false);
  };

  if (!hydrated) {
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
        <Sparkles className="h-5 w-5 text-flamingo" />
        <h2 className="font-display text-2xl gradient-text flex-1">
          {t(lang, "bingo_title")}
        </h2>
        {struck.size > 0 && (
          <button
            type="button"
            onClick={reset}
            className="text-xs text-white/55 hover:text-white inline-flex items-center gap-1.5"
            aria-label={t(lang, "bingo_reset")}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {t(lang, "bingo_reset")}
          </button>
        )}
      </header>

      {/* Ticker — strikes from other voters. */}
      <div className="min-h-[28px]">
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
                  <span className="font-display">{tk.by}</span> →{" "}
                  {tk.trope}
                </>
              )}
            </motion.p>
          ))}
        </AnimatePresence>
      </div>

      <div className="grid grid-cols-5 gap-1.5">
        {card.map((tropeIdx, i) => {
          const isFree = tropeIdx === FREE_SQUARE;
          const isStruck = isFree || struck.has(tropeIdx);
          const label = isFree
            ? t(lang, "bingo_free")
            : getTrope(tropeIdx, lang);
          return (
            <button
              key={i}
              type="button"
              onClick={() => toggle(tropeIdx)}
              aria-pressed={isStruck}
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
                ) : (
                  label
                )}
              </span>
              {isStruck && !isFree && (
                <motion.span
                  layoutId={`strike-${i}`}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 480, damping: 22 }}
                  className="absolute inset-0 rounded-xl pointer-events-none"
                  style={{
                    background:
                      "radial-gradient(circle, oklch(70.55% 0.2725 336.19 / 0.18), transparent 70%)",
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-white/40 text-center pt-1">
        {t(lang, "bingo_footer")}
      </p>
    </main>
  );
}
