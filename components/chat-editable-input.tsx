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
      // On iOS the keyboard's blue "Send" key (enterKeyHint="send") DOES
      // dispatch keydown with key="Enter" — but only sometimes; some
      // virtual-keyboard versions / autocorrect quirks dispatch with
      // key="Unidentified" or no keydown at all and surface only a
      // beforeinput event with inputType="insertParagraph". Catch both.
      onBeforeInput={(e) => {
        const native = e.nativeEvent as InputEvent;
        const inputType = native.inputType;
        if (inputType === "insertParagraph" || inputType === "insertLineBreak") {
          // For Shift+Enter we WANT a line break — but the keydown above
          // handles that path via execCommand, so any beforeinput for
          // paragraph/linebreak that reaches here is the "Send" tap.
          // Funnel it to the parent's onKeyDown as a synthetic Enter so
          // chat-panel's existing send() logic fires.
          e.preventDefault();
          onKeyDown?.({
            key: "Enter",
            shiftKey: false,
            preventDefault: () => {},
          } as KeyboardEvent<HTMLDivElement>);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.shiftKey) {
          e.preventDefault();
          document.execCommand("insertLineBreak");
          return;
        }
        // The "Send" key on most iOS keyboards fires keydown with
        // key="Enter"; some autocorrect-suggested variants leave key
        // empty or set keyCode 13 — accept either as a send signal.
        if (
          e.key === "Enter" ||
          (e as unknown as { keyCode?: number }).keyCode === 13
        ) {
          // Pass through (parent calls preventDefault + send()).
          onKeyDown?.(e);
          return;
        }
        onKeyDown?.(e);
      }}
      onPaste={(e) => {
        const hasImage = Array.from(e.clipboardData.items).some((i) =>
          i.type.startsWith("image/"),
        );
        if (hasImage) {
          // Always stop the contentEditable from inserting the image
          // inline as base64 — even if the parent forgets to. The
          // parent's onPaste reads the file off clipboardData (which is
          // still populated after preventDefault) and queues it.
          e.preventDefault();
          onPaste?.(e);
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
