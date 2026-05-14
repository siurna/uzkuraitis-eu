"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles } from "lucide-react";
import { requestExplanation, type ExplanationHit } from "@/lib/beginner-batcher";
import type { Language } from "@/lib/i18n";

// Renders a short Eurovision-reference explainer under an incoming
// chat message when the user has flipped the beginner-mode toggle on.
// Same shape as <TranslationBubble> (batched, mounts → fetches → may
// render nothing if no reference was detected) but tinted with the
// turquoise "tip" palette so a translation bubble + a beginner bubble
// can co-exist under the same message without reading as duplicates.

export function BeginnerBubble({
  text,
  lang,
  mine,
}: {
  text: string;
  lang: Language;
  /** Right-align under your own messages so the bubble hugs its parent. */
  mine: boolean;
}) {
  const [hit, setHit] = useState<ExplanationHit | null>(null);

  useEffect(() => {
    let cancelled = false;
    requestExplanation(text, lang).then((r) => {
      if (!cancelled) {
        setHit(r);
        if (r.explain && r.text) {
          // Bubble just grew — re-run the chat panel's sticky-scroll
          // hook so the reader doesn't have to drag to see the gloss.
          requestAnimationFrame(() =>
            window.dispatchEvent(new Event("uzk:chat-media-loaded")),
          );
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [text, lang]);

  if (!hit || !hit.explain || !hit.text) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        className={`text-[12px] leading-snug px-2.5 py-1.5 rounded-xl ring-1 ring-turquoise/25 bg-turquoise/[0.07] text-white/85 ${
          mine ? "self-end" : "self-start"
        } max-w-[min(100%,22rem)]`}
      >
        <Sparkles className="inline h-3 w-3 text-turquoise mr-1.5 align-[-0.05em]" />
        <span className="break-words">{hit.text}</span>
      </motion.div>
    </AnimatePresence>
  );
}
