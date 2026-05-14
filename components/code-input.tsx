"use client";

import {
  type ClipboardEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
} from "react";
import { cn } from "@/lib/utils";

const LENGTH = 6;
// Same alphabet as lib/rooms.ts. We exclude 0 (looks like O on
// most fonts) and I/L (look like 1) but DO allow O — hosts wanted
// to type memorable codes like "HELLOX" without the picker
// stripping the O.
const ALPHABET = /^[2-9ABCDEFGHJKMNOPQRSTUVWXYZ]$/;

// Six-cell OTP-style input rendered as a single conjoined pill — one outer
// rounded border, dashed dividers between cells, no gaps. Each cell is its
// own focusable <input>; cursor moves between them automatically.
export function CodeInput({
  value,
  onChange,
  onComplete,
  autoFocus,
  disabled,
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  onComplete?: (code: string) => void;
  autoFocus?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const cells = Array.from({ length: LENGTH }, (_, i) => value[i] ?? "");

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  const setAt = (index: number, char: string) => {
    const sanitized = char.toUpperCase().replace(/[^2-9ABCDEFGHJKMNOPQRSTUVWXYZ]/g, "").slice(0, 1);
    if (!sanitized) return;
    const next = (value + " ".repeat(LENGTH))
      .slice(0, LENGTH)
      .split("")
      .map((c, i) => (i === index ? sanitized : c))
      .join("")
      .replace(/\s+$/g, "");
    onChange(next);
    if (index < LENGTH - 1) refs.current[index + 1]?.focus();
    else if (next.length === LENGTH) onComplete?.(next);
  };

  const handleKey = (index: number) => (e: KeyboardEvent<HTMLInputElement>) => {
    // Don't intercept modifier combos (Cmd+V, Ctrl+V, Cmd+A, etc.) — let
    // the browser deliver the paste / select-all / shortcut natively.
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    if (e.key === "Backspace") {
      e.preventDefault();
      const current = cells[index];
      if (current) {
        onChange(value.slice(0, index) + value.slice(index + 1));
      } else if (index > 0) {
        onChange(value.slice(0, index - 1) + value.slice(index));
        refs.current[index - 1]?.focus();
      }
      return;
    }
    if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      refs.current[index - 1]?.focus();
      return;
    }
    if (e.key === "ArrowRight" && index < LENGTH - 1) {
      e.preventDefault();
      refs.current[index + 1]?.focus();
      return;
    }
    if (e.key.length === 1 && ALPHABET.test(e.key.toUpperCase())) {
      e.preventDefault();
      setAt(index, e.key);
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text").toUpperCase();
    const filtered = pasted.replace(/[^2-9ABCDEFGHJKMNOPQRSTUVWXYZ]/g, "").slice(0, LENGTH);
    if (!filtered) return;
    e.preventDefault();
    onChange(filtered);
    const focusIndex = Math.min(filtered.length, LENGTH - 1);
    refs.current[focusIndex]?.focus();
    if (filtered.length === LENGTH) onComplete?.(filtered);
  };

  return (
    <div
      role="group"
      aria-label="Room code"
      className={cn(
        // One pill, six segments. focus-within glows the whole thing.
        "grid w-full grid-cols-6 items-stretch overflow-hidden rounded-2xl",
        "border border-white/15 bg-black/30 transition",
        "focus-within:border-flamingo focus-within:shadow-glow-pink",
        disabled && "opacity-40 pointer-events-none",
        className,
      )}
    >
      {cells.map((char, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="text"
          inputMode="text"
          autoCapitalize="characters"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          spellCheck={false}
          disabled={disabled}
          aria-label={`Character ${i + 1} of ${LENGTH}`}
          // No maxLength: we want browsers to deliver the full pasted
          // string (iOS SMS autofill, Android suggestion strip, password
          // managers) so we can spread it across cells. We trim down to
          // 1 char ourselves below.
          value={char}
          onChange={(e) => {
            const raw = e.target.value;
            if (!raw) return;
            // Multi-char input (paste / autofill / IME): spread across
            // cells starting from this one.
            if (raw.length > 1) {
              const filtered = raw
                .toUpperCase()
                .replace(/[^2-9ABCDEFGHJKMNOPQRSTUVWXYZ]/g, "")
                .slice(0, LENGTH - i);
              if (!filtered) return;
              const next = (value.slice(0, i) + filtered).slice(0, LENGTH);
              onChange(next);
              const focusIdx = Math.min(i + filtered.length, LENGTH - 1);
              refs.current[focusIdx]?.focus();
              if (next.length === LENGTH) onComplete?.(next);
            } else {
              setAt(i, raw);
            }
          }}
          onKeyDown={handleKey(i)}
          onPaste={handlePaste}
          className={cn(
            // Square cell, no individual border-radius (the outer pill
            // handles rounded corners).
            "aspect-square w-full min-w-0 p-0 bg-transparent",
            // Dashed vertical divider between cells, none after the last.
            i > 0 && "border-l border-dashed border-white/10",
            // No active-cell fill. The outer pill's rainbow border
            // glow + caret are signal enough; a per-cell flamingo
            // background read as decorative noise on focus.
            "focus:outline-none",
            // Singing Sans has top-heavy metrics — pt nudges the
            // cap-height visually centred in the cell, and pb gives
            // the line proper breathing room below so the glyphs
            // don't kiss the cell's bottom rule. Combined with
            // leading-none the visual centre lands on the actual
            // letters, not on the line-box.
            "text-center font-display uppercase tabular-nums leading-none pt-2 pb-3",
            "text-3xl sm:text-4xl text-white caret-flamingo",
            // Suppress text selection: tapping a cell shouldn't drag-
            // select neighbouring cells, and auto-select-on-focus is
            // gone above (it was making the first letter randomly
            // highlight when the input took focus on iOS).
            "select-none [&::selection]:bg-transparent",
          )}
        />
      ))}
    </div>
  );
}
