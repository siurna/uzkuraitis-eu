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

// Six-cell OTP-style input for the room code. Auto-advances on entry,
// rolls back on backspace, accepts a 6-char paste into any cell.
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
        // delete just this cell, stay focused
        onChange(value.slice(0, index) + value.slice(index + 1));
      } else if (index > 0) {
        // jump back and clear the previous cell
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
      className={cn(
        "flex items-center justify-center gap-2 sm:gap-3",
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
          aria-label={`Room code character ${i + 1} of ${LENGTH}`}
          maxLength={1}
          value={char}
          onChange={() => {
            // Native onChange fires after our keydown handler already ran,
            // but we need it for IME / mobile autofill paths.
            const last = refs.current[i]?.value ?? "";
            if (last) setAt(i, last);
          }}
          onKeyDown={handleKey(i)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          className={cn(
            "h-16 w-12 sm:h-20 sm:w-16 rounded-xl border bg-black/30",
            "text-center font-display uppercase tabular-nums",
            // Match line-height to box height so the character sits dead-
            // center instead of floating to the baseline (Singing Sans has
            // generous metrics). pb is a small optical nudge for the cap.
            "text-4xl sm:text-5xl leading-[64px] sm:leading-[80px]",
            "text-white caret-flamingo align-middle pb-0",
            "border-white/15 focus:border-flamingo focus:outline-none",
            "focus:ring-2 focus:ring-flamingo/40 transition",
            "disabled:opacity-40",
            char && "border-flamingo/60 bg-flamingo/10",
          )}
        />
      ))}
    </div>
  );
}
