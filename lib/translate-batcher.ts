"use client";

// Module-level batcher: every <TranslationBubble> calls
// `requestTranslation(text)` and gets a Promise back. We hold the
// requests in a queue, flush after a 100ms quiet window (or when 50
// distinct texts have piled up), and fire ONE POST to /api/translate
// containing every unique text. The server returns parallel results;
// we resolve every queued promise with the answer for its text.
//
// Cache semantics:
// - The cache is module-level, so within a tab the same text never
//   re-fetches (even if the bubble re-mounts).
// - Server-side cache is a second line of defence so other tabs /
//   warm Vercel instances also short-circuit duplicates.

export type TranslationHit = { translate: boolean; text: string };

const cache = new Map<string, TranslationHit>();
const inflight = new Map<string, Promise<TranslationHit>>();

type Pending = { text: string; resolve: (h: TranslationHit) => void };
let queue: Pending[] = [];
let flushTimer: number | null = null;

const FLUSH_DELAY_MS = 100;
const MAX_BATCH = 50;

const EMPTY: TranslationHit = { translate: false, text: "" };

/** Get a translation for `text` — batches with sibling calls. */
export function requestTranslation(text: string): Promise<TranslationHit> {
  if (!text) return Promise.resolve(EMPTY);
  const cached = cache.get(text);
  if (cached) return Promise.resolve(cached);
  const flying = inflight.get(text);
  if (flying) return flying;

  const p = new Promise<TranslationHit>((resolve) => {
    queue.push({ text, resolve });
    if (queue.length >= MAX_BATCH) {
      flushNow();
    } else if (flushTimer == null) {
      flushTimer = window.setTimeout(flushNow, FLUSH_DELAY_MS);
    }
  });
  inflight.set(text, p);
  return p;
}

function flushNow(): void {
  if (flushTimer != null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  const batch = queue;
  if (batch.length === 0) return;
  queue = [];

  // Dedupe within the batch — a single text can have many waiters but
  // only goes on the wire once.
  const uniq: string[] = [];
  const seen = new Set<string>();
  const waiters = new Map<string, Pending[]>();
  for (const item of batch) {
    if (!seen.has(item.text)) {
      seen.add(item.text);
      uniq.push(item.text);
      waiters.set(item.text, [item]);
    } else {
      waiters.get(item.text)!.push(item);
    }
  }

  fetch("/api/translate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ texts: uniq }),
  })
    .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
    .then((data: { results?: TranslationHit[] }) => {
      const results = data.results ?? [];
      for (let i = 0; i < uniq.length; i++) {
        const text = uniq[i];
        const hit = results[i] ?? EMPTY;
        cache.set(text, hit);
        inflight.delete(text);
        for (const w of waiters.get(text) ?? []) w.resolve(hit);
      }
    })
    .catch(() => {
      // Network blip / 429 / unconfigured: resolve everyone with the
      // empty result — bubble simply doesn't render. Cache the empty
      // for a short window? No — let the next attempt retry, the user
      // might have toggled translate off then back on.
      for (const text of uniq) {
        inflight.delete(text);
        for (const w of waiters.get(text) ?? []) w.resolve(EMPTY);
      }
    });
}
