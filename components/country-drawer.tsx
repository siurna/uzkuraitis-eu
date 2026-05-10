"use client";

import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { Search, Check } from "lucide-react";
import { countries, getCountry } from "@/lib/countries";
import { Flag } from "@/components/flag";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { readLang, t } from "@/lib/i18n";

// Country picker: bottom-sheet (single OR multi mode) used by the
// ballot, every bonus-bet country pick, and the side-bet facts editor.
// Sits on top of the shared <BottomSheet/> primitive so its frame
// (handle, header, footer, scroll, dismissal, body-lock) matches the
// rest of the app exactly.

export type DrawerProps = {
  open: boolean;
  onClose: () => void;
  onPick: (codes: string[] | string | null) => void;
  selected: string[];
  options?: readonly string[];
  allowNone?: boolean;
  title: string;
  sub?: string;
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
  const [lang, setLang] = useState<"en" | "lt">("en");
  // One-shot flying heart spawned on a single-mode pick: bursts from
  // the tapped tile and drifts up + fades. Drawer closes immediately
  // after — the burst plays in the portal layer so it survives.
  const [burst, setBurst] = useState<{
    id: number;
    code: string;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(selected);
      setQuery("");
      setLang(readLang());
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

  const toggle = (code: string, event?: React.MouseEvent<HTMLButtonElement>) => {
    if (mode === "single") {
      // Capture the tapped tile's centre so the heart bursts from
      // exactly where the user pressed, not from a hard-coded spot.
      if (event) {
        const rect = event.currentTarget.getBoundingClientRect();
        setBurst({
          id: Date.now(),
          code,
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        });
      }
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
    <>
      <FlyingHeartLayer
        burst={burst}
        onDone={() => setBurst(null)}
      />
    <BottomSheet
      open={open}
      onClose={onClose}
      title={title}
      sub={sub}
      footer={
        mode === "multi" ? (
          <>
            <p className="text-xs text-white/55">
              {t(lang, "selected_count", draft.length)}
            </p>
            <div className="flex-1" />
            <Button variant="ghost" size="sm" onClick={onClose}>
              {t(lang, "cancel")}
            </Button>
            <Button
              size="sm"
              onClick={commit}
              className="bg-white text-dark-blue hover:bg-dark-blue-50"
            >
              {t(lang, "done")}
            </Button>
          </>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search country, artist, or song"
            className="h-11 pl-9"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          {allowNone && (
            <DrawerRow
              label={t(lang, "no_country")}
              sub="Nobody scores zero from the public."
              flag={null}
              selected={isSelected(NONE_TOKEN)}
              onClick={(e) => toggle(NONE_TOKEN, e)}
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
                onClick={(e) => toggle(code, e)}
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
      </div>
    </BottomSheet>
    </>
  );
}

// One-shot flying-heart overlay. Renders the picked country's
// heart-flag SVG at the tap coordinates and animates it up + out.
// Portaled so the drawer's exit animation doesn't take it with it.
function FlyingHeartLayer({
  burst,
  onDone,
}: {
  burst: { id: number; code: string; x: number; y: number } | null;
  onDone: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {burst && (
        <motion.div
          key={burst.id}
          initial={{
            left: burst.x - 28,
            top: burst.y - 28,
            opacity: 0,
            scale: 0.6,
            rotate: 0,
          }}
          animate={{
            left: burst.x - 28,
            top: burst.y - 28 - 240,
            opacity: [0, 1, 1, 0],
            scale: [0.6, 1.6, 1.2, 0.9],
            rotate: [0, -12, 8, -4],
          }}
          transition={{
            duration: 1.1,
            ease: [0.2, 0.7, 0.3, 1],
            opacity: { times: [0, 0.12, 0.6, 1] },
            scale: { times: [0, 0.25, 0.6, 1] },
            rotate: { times: [0, 0.3, 0.65, 1] },
          }}
          onAnimationComplete={onDone}
          className="fixed h-14 w-14 z-[70] pointer-events-none
                     drop-shadow-[0_8px_24px_rgba(255,46,222,0.55)]"
        >
          {burst.code === NONE_TOKEN ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/images/70-heart.webp"
              alt=""
              className="h-full w-full object-contain"
            />
          ) : (
            <Flag code={burst.code} size="xl" className="h-full w-full" />
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
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
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  multi: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left
                  transition transform-gpu duration-150 active:scale-[0.98]
                  ${
                    selected
                      ? "bg-flamingo/20 ring-1 ring-flamingo/50 shadow-glow-pink"
                      : "bg-white/[0.04] hover:bg-white/10"
                  }`}
    >
      {flag ? (
        <Flag code={flag} size="md" />
      ) : (
        <div className="h-6 w-8 rounded-[3px] bg-white/10 grid place-items-center text-[10px] uppercase tracking-widest text-white/50 shrink-0">
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
          className={`h-6 w-6 rounded-full grid place-items-center transition shrink-0 ${
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
