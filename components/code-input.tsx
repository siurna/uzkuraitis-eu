"use client";

import {
  type ClipboardEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
} from "react";
import { cn } from "@/lib/utils";

const LENGTH = 6;
// Same alphabet as lib/rooms.ts — no 0/O/1/I/L confusion.
const ALPHABET = /^[2-9A-HJ-NP-Z]$/;

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
    const sanitized = char.toUpperCase().replace(/[^2-9A-HJ-NP-Z]/g, "").slice(0, 1);
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
    const filtered = pasted.replace(/[^2-9A-HJ-NP-Z]/g, "").slice(0, LENGTH);
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
          maxLength={1}
          value={char}
          onChange={() => {
            const last = refs.current[i]?.value ?? "";
            if (last) setAt(i, last);
          }}
          onKeyDown={handleKey(i)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          className={cn(
            // Square cell, no individual border-radius (the outer pill
            // handles rounded corners).
            "aspect-square w-full min-w-0 p-0 bg-transparent",
            // Dashed vertical divider between cells, none after the last.
            i > 0 && "border-l border-dashed border-white/10",
            // Focused cell gets a soft fill so you know which one's live.
            "focus:outline-none focus:bg-flamingo/15",
            // Filled cell stays slightly lit even when not focused.
            char && "bg-flamingo/8",
            // Glyph styling — leading-none + flex-equivalent vertical
            // centering via the input's own line-box is good enough at
            // these aspect-ratios.
            "text-center font-display uppercase tabular-nums leading-none",
            "text-3xl sm:text-4xl text-white caret-flamingo",
          )}
        />
      ))}
    </div>
  );
}
