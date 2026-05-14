"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Languages } from "lucide-react";
import { requestTranslation, type TranslationHit } from "@/lib/translate-batcher";

// Renders an "in English" rendering under an incoming chat message when
// the user has flipped the auto-translate setting on. Batched via
// lib/translate-batcher: every bubble that mounts within a 100ms
// window joins one POST + one model invocation, regardless of how many
// of them there are.

export function TranslationBubble({
  text,
  mine,
}: {
  text: string;
  /** Right-align under your own messages so the translation hugs the
   *  bubble it belongs to. */
  mine: boolean;
}) {
  const [hit, setHit] = useState<TranslationHit | null>(null);

  useEffect(() => {
    let cancelled = false;
    requestTranslation(text).then((r) => {
      if (!cancelled) {
        setHit(r);
        // When a bubble appears (the row's height just grew) we
        // reuse the chat panel's media-loaded sticky-scroll hook so
        // the reader who was parked at the bottom doesn't have to
        // manually drag to see the rendering.
        if (r.translate && r.text) {
          requestAnimationFrame(() =>
            window.dispatchEvent(new Event("uzk:chat-media-loaded")),
          );
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [text]);

  // Nothing if the model said "no need" or we don't have a result yet.
  if (!hit || !hit.translate || !hit.text) return null;

  // Split the response into a literal rendering and the optional
  // `[bracketed context note]` the prompt emits when the message
  // hangs on a Lithuanian reference. We split on the FIRST `[` so a
  // model that returns "rendering [note]" lands the rendering above
  // and the explanation on its own italic line. When there's no
  // bracket the whole text reads as one inline span.
  const open = hit.text.indexOf("[");
  const close = open >= 0 ? hit.text.lastIndexOf("]") : -1;
  const hasNote = open >= 0 && close > open;
  const body = hasNote ? hit.text.slice(0, open).trim() : hit.text;
  const note = hasNote ? hit.text.slice(open + 1, close).trim() : "";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        className={`text-[12px] leading-snug px-2.5 py-1.5 rounded-xl ring-1 ring-flamingo/20 bg-flamingo/[0.06] text-white/85 ${
          mine ? "self-end" : "self-start"
        } max-w-[min(100%,22rem)]`}
      >
        {/* Icon alone is enough — the bubble's flamingo treatment +
            the Languages glyph carry the "this is a translation"
            signal without needing the redundant label. */}
        <Languages className="inline h-3 w-3 text-flamingo mr-1.5 align-[-0.05em]" />
        <span className="break-words">{body}</span>
        {note && (
          // Context note on its own line, italic + dimmer so it
          // reads as a footnote, not the translation itself.
          <span className="block mt-1 italic text-white/65 break-words">
            {note}
          </span>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
