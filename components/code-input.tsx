"use client";

import {
  type ClipboardEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
} from "react";
import { cn } from "@/lib/utils";

const LENGTH = 6;
// Has to match `ROOM_CODE_REGEX` in lib/room-code.ts so anything a
// host can mint as a custom code is also typable here. We exclude
// 0 (looks like O on most fonts) and I/L (look like 1) but DO
// allow 1 and O — hosts can type memorable codes like "PARTY1"
// or "HELLOX" without the input stripping the digit / letter.
const ALPHABET = /^[1-9ABCDEFGHJKMNOPQRSTUVWXYZ]$/;

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
    const sanitized = char.toUpperCase().replace(/[^1-9ABCDEFGHJKMNOPQRSTUVWXYZ]/g, "").slice(0, 1);
    if (!sanitized) return;
    // Clamp the write position to the first empty cell. If the user
    // tapped (say) cell 3 on an empty code, iOS may dispatch the
    // first keystroke to that cell BEFORE the onFocus bounce below
    // shifts focus to cell 0, which would otherwise write "   A"
    // with three leading spaces (and look like the character was
    // "eaten" because the user types again to fix it). Always
    // write into the first unfilled slot regardless of which cell
    // received the input event.
    const writeAt = Math.min(index, value.length);
    const next = (value + " ".repeat(LENGTH))
      .slice(0, LENGTH)
      .split("")
      .map((c, i) => (i === writeAt ? sanitized : c))
      .join("")
      .replace(/\s+$/g, "");
    onChange(next);
    if (writeAt < LENGTH - 1) refs.current[writeAt + 1]?.focus();
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
          onFocus={(e) => {
            // Empty code + the user tapped any cell other than the
            // first → bounce focus to cell 0 so they start typing
            // from position 1 instead of mid-field. iOS especially
            // would otherwise leave focus mid-cell, hitting the
            // physical input but typing-out-of-order vs the
            // displayed cells.
            if (i !== 0 && value === "") {
              e.preventDefault();
              refs.current[0]?.focus();
            }
          }}
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
            // Default browser <input> vertical-centres the value
            // when leading + padding are left to their defaults.
            // Earlier override (`leading-none pt-2 pb-3`) was
            // tuned against Singing Sans's metrics on Chrome
            // desktop but rendered visually high on iOS — the
            // line-box was shorter than the cell and the glyph
            // baseline floated up. Reset to `leading-snug` + no
            // explicit padding; the browser centres the text in
            // the aspect-square cell.
            "text-center font-display uppercase tabular-nums leading-snug",
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
