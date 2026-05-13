"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Languages } from "lucide-react";
import { t } from "@/lib/i18n";
import { useLang } from "@/lib/i18n-client";

// Renders an "in English" rendering under an incoming chat message when
// the user has flipped the auto-translate setting on. The fetch result
// is module-level cached so the same body across 30 connected clients
// only ever runs through the model once per session.

type Cached = { translate: boolean; text: string };
const cache = new Map<string, Promise<Cached>>();

function getTranslation(text: string): Promise<Cached> {
  const cached = cache.get(text);
  if (cached) return cached;
  const promise = fetch("/api/translate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
  })
    .then((r) => (r.ok ? (r.json() as Promise<Cached>) : { translate: false, text: "" }))
    .catch(() => ({ translate: false, text: "" }));
  cache.set(text, promise);
  return promise;
}

export function TranslationBubble({
  text,
  mine,
}: {
  text: string;
  /** Right-align under your own messages so the translation hugs the
   *  bubble it belongs to. */
  mine: boolean;
}) {
  const lang = useLang();
  const [hit, setHit] = useState<Cached | null>(null);

  useEffect(() => {
    let cancelled = false;
    getTranslation(text).then((r) => {
      if (!cancelled) setHit(r);
    });
    return () => {
      cancelled = true;
    };
  }, [text]);

  // Nothing if the model said "no need" or we don't have a result yet.
  if (!hit || !hit.translate || !hit.text) return null;

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
        <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] text-flamingo font-display mr-1.5 align-baseline">
          <Languages className="h-3 w-3" />
          {t(lang, "translate_eyebrow")}
        </span>
        <span className="break-words">{hit.text}</span>
      </motion.div>
    </AnimatePresence>
  );
}
