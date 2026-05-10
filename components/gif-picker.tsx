"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
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

// GIF picker — opens as its own bottom-sheet on top of chat. Debounced
// search hits /api/gif/search which proxies + caches Klipy. Tap a tile
// → calls onPick(url) and closes. Errors degrade to "no results".
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
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        const res = await fetch(
          `/api/gif/search?q=${encodeURIComponent(q)}`,
          { cache: "no-store" },
        );
        if (!res.ok) {
          setResults([]);
        } else {
          const data = (await res.json()) as { results: GifResult[] };
          setResults(data.results);
        }
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [query, open]);

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t(lang, "gif_pick")}
    >
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t(lang, "gif_search")}
            className="h-11 pl-9"
            autoFocus
          />
        </div>

        {loading && results.length === 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="aspect-video rounded-xl bg-white/[0.05] animate-pulse"
              />
            ))}
          </div>
        ) : results.length === 0 ? (
          <p className="text-center text-white/40 text-sm py-8">
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
                  className="block w-full overflow-hidden rounded-xl
                             ring-1 ring-white/10 hover:ring-white/30
                             transition active:scale-[0.98]
                             bg-white/[0.04]"
                  title={g.title}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={g.preview}
                    alt={g.title}
                    className="block w-full h-auto"
                    loading="lazy"
                  />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </BottomSheet>
  );
}
