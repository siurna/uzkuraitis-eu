"use client";

import {
  type ClipboardEvent,
  type KeyboardEvent,
  useRef,
} from "react";
import { cn } from "@/lib/utils";

const LENGTH = 6;
// Same alphabet as lib/room-code.ts. Allows `1`, `I`, `L`, and `O`
// so memorable custom codes like "PARTY1" / "MARIJA" / "LOL123" /
// "HELLOX" type through. Only `0` stays out — too easy to confuse
// with `O` in common UI fonts at small sizes. Filter runs on every
// change + paste.
const ALPHABET_RE = /[^1-9A-Z]/g;

// Six-cell OTP-style input. Visually six cells with dashed dividers,
// but the DOM has exactly ONE `<input>` element underneath — six
// `<div>` overlays paint the characters per cell.
//
// Why one input and not six: iOS Safari's keyboard accessory bar
// renders the `‹ › ✓` navigation arrows whenever it detects multiple
// text inputs on the page. Six per-cell inputs lit the bar up on the
// entrance screen even though there's only one logical field. Going
// to one DOM input makes the bar collapse to its plain "Done" state.
// Tap anywhere in the grid → the single input takes focus → keyboard
// appears → typing fills the cells visually.
//
// The input itself is absolutely positioned over the grid with
// `opacity-0 caret-transparent` so the user sees the overlay divs +
// our own blinking caret instead of the system text rendering. iOS
// SMS-autofill (`autocomplete="one-time-code"`) still works because
// the input is real and focusable.
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
  const inputRef = useRef<HTMLInputElement | null>(null);
  const cells = Array.from({ length: LENGTH }, (_, i) => value[i] ?? "");
  const focusIndex = Math.min(value.length, LENGTH - 1);

  const focusInput = () => inputRef.current?.focus();

  const setValue = (raw: string, fireComplete = true) => {
    const filtered = raw.toUpperCase().replace(ALPHABET_RE, "").slice(0, LENGTH);
    if (filtered === value) return;
    onChange(filtered);
    if (fireComplete && filtered.length === LENGTH) onComplete?.(filtered);
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    // Let modifier combos (Cmd+V / Ctrl+V / Cmd+A) through to the
    // native paste + select-all path.
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    // The input is `maxLength={LENGTH}` so the browser naturally
    // refuses extra chars; we only need Backspace + the alphabet
    // filter, which onChange already applies.
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text");
    if (!pasted) return;
    e.preventDefault();
    setValue(pasted);
  };

  return (
    <div
      role="group"
      aria-label="Room code"
      onClick={focusInput}
      onMouseDown={(e) => {
        // Prevent the click-into-empty-space from losing focus
        // mid-tap on iOS. The onClick above still fires for tap
        // discovery; this just keeps focus across the press.
        if (e.target !== inputRef.current) e.preventDefault();
        focusInput();
      }}
      className={cn(
        // One pill, six visual segments. focus-within glows the
        // whole thing the same as before (the input is real, just
        // invisible — focus-within picks it up).
        "relative grid w-full grid-cols-6 items-stretch overflow-hidden rounded-2xl",
        "border border-white/15 bg-black/30 transition cursor-text",
        "focus-within:border-flamingo focus-within:shadow-glow-pink",
        disabled && "opacity-40 pointer-events-none",
        className,
      )}
    >
      {/* The single underlying <input>. iOS sees ONE form control —
          no navigation arrows in the keyboard accessory bar. The
          field is positioned absolutely over the entire grid;
          tap-anywhere routes through the wrapper's onClick. */}
      <input
        ref={inputRef}
        type="text"
        inputMode="text"
        // SMS autofill for OTPs — the platform convention. Filters
        // come from `ALPHABET_RE`, so a 6-digit code from a text
        // message would pass through cleanly. Not that we send any,
        // but the attribute doesn't hurt.
        autoComplete="one-time-code"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="go"
        disabled={disabled}
        maxLength={LENGTH}
        autoFocus={autoFocus}
        aria-label={`Room code, ${LENGTH} characters`}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKey}
        onPaste={handlePaste}
        className="absolute inset-0 z-10 w-full h-full bg-transparent
                   text-transparent caret-transparent select-none
                   focus:outline-none"
        // Belt-and-braces: hide any browser-default text rendering
        // through colour + caret transparency so only the cell
        // overlays below are visible.
        style={{ color: "transparent", caretColor: "transparent" }}
      />

      {/* Cell overlays. Each one shows the character at its index
          (or nothing) + a blinking caret on the next-to-fill cell. */}
      {cells.map((char, i) => (
        <div
          key={i}
          aria-hidden
          className={cn(
            "relative aspect-square w-full min-w-0",
            // Dashed vertical divider between cells, none after the last.
            i > 0 && "border-l border-dashed border-white/10",
            "flex items-center justify-center",
            "font-display uppercase tabular-nums",
            // `leading-none` tightens the text line-box to the font
            // size so the flex centering centres the GLYPH, not the
            // taller line-box that includes Singing Sans's default
            // descender padding — which is what was leaving the
            // letters floating visibly above the cell centre.
            "leading-none",
            "text-3xl sm:text-4xl text-white",
            "select-none",
          )}
        >
          {char}
          {/* Blink the caret on whichever cell would receive the
              next character. The CSS uses `animate-pulse` instead of
              a manual @keyframes; close enough to a caret blink. */}
          {!char && i === focusIndex && (
            <span
              className="absolute h-[1.2em] w-[2px] bg-flamingo animate-pulse"
              aria-hidden
            />
          )}
        </div>
      ))}
    </div>
  );
}
