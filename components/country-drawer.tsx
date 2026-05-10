"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Search, X, Check } from "lucide-react";
import { countries, getCountry } from "@/lib/countries";
import { Flag } from "@/components/flag";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// Bottom-sheet drawer that lets the voter pick a country (or N countries
// in multi-mode) for a bet. Replaces the cramped <select> dropdown that
// hid the artist + song info.
//
// Used by the bonus-bets form. Mounted at the page level on demand and
// dismissed by tapping the backdrop, the close button, or, in single-pick
// mode, the choice itself.

export type DrawerProps = {
  open: boolean;
  onClose: () => void;
  onPick: (codes: string[] | string | null) => void;
  /** Currently selected codes (always an array; single-mode reads index 0). */
  selected: string[];
  /** Subset of country codes to show. Defaults to every finalist. */
  options?: readonly string[];
  /** Render a "No country" option above the list (nul-points televote). */
  allowNone?: boolean;
  /** Title shown at the top of the drawer. */
  title: string;
  /** Optional supporting copy below the title. */
  sub?: string;
  /** "single" closes on pick; "multi" stays open + shows a Done button. */
  mode?: "single" | "multi";
};

const NONE_TOKEN = "NONE";

export function CountryDrawer({
  open,
  onClose,
  onPick,
  selected,
  options,
  allowNone,
  title,
  sub,
  mode = "single",
}: DrawerProps) {
  const list = useMemo(
    () => (options ? options.slice() : countries.map((c) => c.code)),
    [options],
  );
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<string[]>(selected);

  // Reset draft state every time the drawer reopens so cancelling really
  // cancels (multi-mode only; single mode commits immediately on pick).
  useEffect(() => {
    if (open) {
      setDraft(selected);
      setQuery("");
    }
  }, [open, selected]);

  const filtered = list.filter((code) => {
    if (!query.trim()) return true;
    const c = getCountry(code);
    const q = query.trim().toLowerCase();
    return (
      c?.name.toLowerCase().includes(q) ||
      c?.artist.toLowerCase().includes(q) ||
      c?.song.toLowerCase().includes(q) ||
      code.includes(q)
    );
  });

  const isSelected = (code: string) => draft.includes(code);

  const toggle = (code: string) => {
    if (mode === "single") {
      onPick(code);
      onClose();
      return;
    }
    setDraft((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  };

  const commit = () => {
    if (mode === "single") return; // single-mode auto-commits
    onPick(draft.length === 0 ? null : draft);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="drawer"
          className="fixed inset-0 z-50 flex flex-col justify-end"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="absolute inset-0 bg-dark-blue-900/70 backdrop-blur-sm"
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="relative glass-card rounded-t-3xl border-x-0 border-b-0
                       max-h-[85vh] flex flex-col"
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-2 pb-1 shrink-0">
              <div className="h-1 w-10 rounded-full bg-white/20" />
            </div>

            {/* Header */}
            <div className="px-5 pb-3 flex items-start gap-3 shrink-0">
              <div className="flex-1 min-w-0">
                <h2 className="font-display text-xl gradient-text">{title}</h2>
                {sub && (
                  <p className="text-xs text-white/55 mt-1 leading-relaxed">
                    {sub}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-white/50 hover:text-white p-1 -m-1 transition"
                aria-label="Close drawer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Search */}
            <div className="px-5 pb-3 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 pointer-events-none" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search country, artist, or song"
                  className="h-11 pl-9"
                />
              </div>
            </div>

            {/* List */}
            <div className="overflow-y-auto px-3 pb-3 flex flex-col gap-1.5">
              {allowNone && (
                <DrawerRow
                  label="No country"
                  sub="Nobody scores zero from the public."
                  flag={null}
                  selected={isSelected(NONE_TOKEN)}
                  onClick={() => toggle(NONE_TOKEN)}
                  multi={mode === "multi"}
                />
              )}
              {filtered.map((code) => {
                const c = getCountry(code);
                if (!c) return null;
                return (
                  <DrawerRow
                    key={code}
                    label={c.name}
                    sub={c.artist}
                    sub2={c.song}
                    flag={code}
                    selected={isSelected(code)}
                    onClick={() => toggle(code)}
                    multi={mode === "multi"}
                  />
                );
              })}
              {filtered.length === 0 && (
                <p className="text-center text-white/40 text-sm py-8">
                  No matches.
                </p>
              )}
            </div>

            {/* Footer (multi mode only) */}
            {mode === "multi" && (
              <div className="px-5 py-3 border-t border-white/5 shrink-0 flex items-center gap-3">
                <p className="text-xs text-white/55">
                  {draft.length} selected
                </p>
                <div className="flex-1" />
                <Button variant="ghost" size="sm" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={commit}
                  className="bg-gradient-to-r from-gold via-flamingo to-purple text-white"
                >
                  Done
                </Button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function DrawerRow({
  label,
  sub,
  sub2,
  flag,
  selected,
  onClick,
  multi,
}: {
  label: string;
  sub?: string;
  sub2?: string;
  flag: string | null;
  selected: boolean;
  onClick: () => void;
  multi: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left
                  transition transform-gpu duration-150 active:scale-[0.98]
                  ${selected
                    ? "bg-flamingo/20 border border-flamingo/50 shadow-glow-pink"
                    : "bg-white/5 border border-transparent hover:bg-white/10"}`}
    >
      {flag ? (
        <Flag code={flag} size="md" />
      ) : (
        <div className="h-6 w-8 rounded-[3px] bg-white/10 grid place-items-center text-[10px] uppercase tracking-widest text-white/50">
          —
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="font-display truncate">{label}</p>
        {sub && (
          <p className="text-xs text-white/55 truncate">
            {sub}
            {sub2 && (
              <>
                <span className="mx-1.5 text-white/25">·</span>
                <span className="italic">{sub2}</span>
              </>
            )}
          </p>
        )}
      </div>
      {multi && (
        <div
          className={`h-6 w-6 rounded-full grid place-items-center transition ${
            selected
              ? "bg-flamingo text-white shadow-glow-pink"
              : "border border-white/20 text-white/0"
          }`}
        >
          <Check className="h-4 w-4" />
        </div>
      )}
    </button>
  );
}
