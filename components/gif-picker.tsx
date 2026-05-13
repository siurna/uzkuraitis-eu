"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useLang, t } from "@/lib/i18n";

type GifResult = {
  id: string;
  title: string;
  url: string;
  preview: string;
  width: number;
  height: number;
};

// GIF picker — a near-full-height modal sized to the *visual viewport*,
// so it sits from just below the top of the screen down to the on-screen
// keyboard (the search input autofocuses). Tap a tile → onPick(url) +
// close. Errors degrade to "no results". Portaled to <body> to dodge
// transformed ancestors (see BottomSheet for the why). Debounced search
// hits /api/gif/search which proxies + caches Klipy.
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
            className="fixed inset-x-3 sm:inset-x-0 z-[70] mx-auto w-auto sm:w-full max-w-md
                       glass-card rounded-3xl overflow-hidden flex flex-col"
            style={vv ? { top: vv.top + 12, height: vv.h - 12 } : { top: 12, bottom: 12 }}
          >
            <div className="shrink-0 px-4 pt-3 pb-2 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-dark-blue-200 pointer-events-none" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t(lang, "gif_search")}
                  className="h-11 pl-9"
                  autoFocus
                />
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={t(lang, "close")}
                className="shrink-0 h-11 w-11 rounded-full grid place-items-center text-dark-blue-200 hover:text-white transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
              {loading && results.length === 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="aspect-video rounded-xl bg-white/[0.05] animate-pulse" />
                  ))}
                </div>
              ) : results.length === 0 ? (
                <p className="text-center text-white/40 text-sm py-10">
                  {query.trim() ? t(lang, "gif_empty") : t(lang, "gif_hint")}
                </p>
              ) : (
                <ul className="grid grid-cols-2 gap-2">
                  {results.map((g) => (
                    <li key={g.id}>
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
