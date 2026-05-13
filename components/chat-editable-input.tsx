"use client";

import { useEffect, type ClipboardEvent, type HTMLAttributes, type KeyboardEvent, type RefObject } from "react";

// Lightweight contentEditable wrapper used by the chat composer.
//
// Why not <textarea>? On iOS Safari, textarea triggers the "‹ › Done"
// keyboard accessory bar which steals 44px of viewport — fatal for a
// chat composer pinned to the visual-viewport bottom. A contenteditable
// div doesn't get the bar.
//
// We keep it behaving like a plain text field:
//   - paste is sanitised to plain text (image paste is forwarded to
//     the caller so it can run through the upload pipeline);
//   - Shift+Enter inserts a single line break, not a nested <div>;
//   - length is clamped to maxLength;
//   - the DOM is only written from outside when `value` changes from a
//     non-typing source (send clears it, edit-mode pre-fills it, an
//     @mention insertion rewrites it). `data-empty` drives the CSS
//     placeholder (see globals.css).
export function ChatEditableInput({
  value,
  onChange,
  onKeyDown,
  onPaste,
  onFocus,
  onBlur,
  placeholder,
  className,
  innerRef,
  maxLength = 2000,
  enterKeyHint,
}: {
  value: string;
  onChange: (v: string) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLDivElement>) => void;
  onPaste?: (e: ClipboardEvent<HTMLDivElement>) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  placeholder: string;
  className?: string;
  innerRef: RefObject<HTMLDivElement | null>;
  maxLength?: number;
  enterKeyHint?: HTMLAttributes<HTMLDivElement>["enterKeyHint"];
}) {
  const caretToEnd = (el: HTMLElement) => {
    const r = document.createRange();
    r.selectNodeContents(el);
    r.collapse(false);
    const s = window.getSelection();
    s?.removeAllRanges();
    s?.addRange(r);
  };

  // Mirror external value changes into the DOM (no-op while typing, since
  // `value` already equals the DOM text then).
  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const cur = el.innerText === "\n" ? "" : el.innerText;
    if (cur !== value) {
      el.innerText = value;
      if (document.activeElement === el) caretToEnd(el);
    }
    el.toggleAttribute("data-empty", value.length === 0);
  }, [value, innerRef]);

  const readAndEmit = (el: HTMLElement) => {
    let text = el.innerText;
    if (text === "\n") text = "";
    if (text.length > maxLength) {
      text = text.slice(0, maxLength);
      el.innerText = text;
      caretToEnd(el);
    }
    el.toggleAttribute("data-empty", text.length === 0);
    onChange(text);
  };

  return (
    <div
      ref={innerRef}
      role="textbox"
      aria-multiline="true"
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder}
      enterKeyHint={enterKeyHint}
      autoCapitalize="sentences"
      onInput={(e) => readAndEmit(e.currentTarget)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.shiftKey) {
          e.preventDefault();
          document.execCommand("insertLineBreak");
          return;
        }
        onKeyDown?.(e);
      }}
      onPaste={(e) => {
        const hasImage = Array.from(e.clipboardData.items).some((i) =>
          i.type.startsWith("image/"),
        );
        if (hasImage) {
          if (onPaste) onPaste(e);
          else e.preventDefault();
          return;
        }
        e.preventDefault();
        const txt = e.clipboardData.getData("text/plain");
        if (txt) document.execCommand("insertText", false, txt);
      }}
      onFocus={onFocus}
      onBlur={onBlur}
      className={className}
    />
  );
}
