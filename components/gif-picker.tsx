"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { Search, X } from "lucide-react";
import { t } from "@/lib/i18n";
import { useLang } from "@/lib/i18n-client";

type GifResult = {
  id: string;
  title: string;
  url: string;
  preview: string;
  width: number;
  height: number;
};

// One-tap reaction prompts shown when the search box is empty — pill
// buttons that drop straight into the search field. Klipy-friendly
// queries, intentionally not localised (the GIF index is English).
const QUICK_QUERIES = [
  "yes",
  "omg",
  "fire",
  "lol",
  "no way",
  "love",
  "shocked",
  "thank you",
  "applause",
  "dance",
];

// GIF picker — a near-full-height modal sized to the *visual viewport*,
// so it sits from just below the top of the screen down to the on-screen
// keyboard (the search input autofocuses). Tap a tile → onPick(url) +
// close. Errors degrade to "no results". Portaled to <body> to dodge
// transformed ancestors (see BottomSheet for the why). Debounced search
// hits /api/gif/search which proxies + caches Klipy. The results render
// in a CSS-column masonry so tall and short tiles flow naturally.
export function GifPicker({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (url: string) => void;
}) {
  const lang = useLang();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GifResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [vv, setVv] = useState<{ top: number; h: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => setMounted(true), []);

  // Track the bit of the page above the keyboard while open.
  useEffect(() => {
    if (!open) return;
    const win = window.visualViewport;
    const update = () =>
      setVv(win ? { top: win.offsetTop, h: win.height } : { top: 0, h: window.innerHeight });
    update();
    win?.addEventListener("resize", update);
    win?.addEventListener("scroll", update);
    return () => {
      win?.removeEventListener("resize", update);
      win?.removeEventListener("scroll", update);
    };
  }, [open]);

  // Lock body scroll while the picker is up so swipes inside the modal
  // don't bleed through to the room behind it.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
    }
  }, [open]);

  // Debounced search.
  useEffect(() => {
    if (!open) return;
    if (debounce.current) clearTimeout(debounce.current);
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    setLoading(true);
    debounce.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/gif/search?q=${encodeURIComponent(q)}`, { cache: "no-store" });
        setResults(res.ok ? ((await res.json()) as { results: GifResult[] }).results : []);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [query, open]);

  // Esc to close.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            key="gif-backdrop"
            type="button"
            aria-label={t(lang, "close")}
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[70] bg-dark-blue-900/75 backdrop-blur-sm"
          />
          <motion.div
            key="gif-modal"
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.98 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            // Width matches the BottomSheet drawers — same a-few-px
            // gutter on mobile, capped on tablet/desktop.
            className="fixed inset-x-2 sm:inset-x-0 z-[70] mx-auto w-auto sm:w-full max-w-md
                       glass-card rounded-3xl overflow-hidden flex flex-col"
            style={vv ? { top: vv.top + 12, height: vv.h - 12 } : { top: 12, bottom: 12 }}
          >
            {/* Top bar: search field + close X share one flex row so the
                X stays vertically centred on the input no matter the
                viewport height. */}
            <div className="shrink-0 px-4 pt-3 pb-2 flex items-center gap-2">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-dark-blue-200 pointer-events-none" />
                <input
                  ref={inputRef}
                  // type="text" not "search" — the native ::-webkit-
                  // search-cancel-button was drawing a second X on top
                  // of ours (the "double X" we keep hearing about). We
                  // render our own clear control so we don't need the
                  // browser's. name/auto* block the phone's "username/
                  // email" autofill prompt that fires on text inputs.
                  type="text"
                  name="gif-search"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  enterKeyHint="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t(lang, "gif_search")}
                  className="h-11 w-full rounded-2xl border border-white/15 bg-black/30 pl-9 pr-9
                             text-sm text-white placeholder:text-white/40
                             focus:border-flamingo focus:outline-none focus:ring-2 focus:ring-flamingo/40 transition"
                  autoFocus
                />
                {/* Our clear-X — animated in/out so it doesn't pop. */}
                <AnimatePresence>
                  {query.length > 0 && (
                    <motion.button
                      key="clear"
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setQuery("");
                        inputRef.current?.focus();
                      }}
                      aria-label={t(lang, "clear")}
                      initial={{ opacity: 0, scale: 0.6 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.6 }}
                      transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 grid place-items-center
                                 rounded-full text-white/55 hover:text-white hover:bg-white/10 transition"
                    >
                      <X className="h-3.5 w-3.5" />
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={t(lang, "close")}
                className="shrink-0 h-11 w-11 grid place-items-center rounded-full
                           text-white/55 hover:text-white hover:bg-white/10 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
              {loading && results.length === 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="aspect-video rounded-xl bg-white/[0.05] skeleton" />
                  ))}
                </div>
              ) : results.length === 0 ? (
                query.trim() ? (
                  <p className="text-center text-white/40 text-sm py-10">{t(lang, "gif_empty")}</p>
                ) : (
                  // Empty-state: pill suggestions instead of a hint
                  // string. Tapping one drops the query straight into
                  // the search box and fires the debounced fetch.
                  <div className="flex flex-wrap justify-center gap-2 pt-6 px-2">
                    {QUICK_QUERIES.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => {
                          setQuery(q);
                          inputRef.current?.focus();
                        }}
                        className="h-9 px-4 rounded-full bg-white/[0.06] ring-1 ring-white/12
                                   text-sm text-white/85 hover:bg-white/[0.12] hover:ring-white/25
                                   active:scale-[0.97] transition transform-gpu"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )
              ) : (
                // CSS columns masonry — tall + short tiles tile cleanly
                // without a JS layout pass.
                <ul className="columns-2 gap-2 [column-fill:_balance]">
                  {results.map((g) => (
                    <li key={g.id} className="mb-2 break-inside-avoid">
                      <button
                        type="button"
                        onClick={() => {
                          onPick(g.url);
                          onClose();
                        }}
                        className="block w-full overflow-hidden rounded-xl ring-1 ring-white/10
                                   transition active:scale-[0.98] bg-white/[0.04]"
                        title={g.title}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={g.preview} alt={g.title} className="block w-full h-auto" loading="lazy" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
