"use client";

// Module-level batcher for /api/explain (beginner-mode Eurovision
// reference helper). Same shape as translate-batcher: every
// <BeginnerBubble> calls `requestExplanation(text, lang)` and a queue
// flushes after a 100ms quiet window (or when 50 distinct texts are
// piled up). Cache is keyed by `${lang}\n${text}` so a flip between LT
// and EN doesn't reuse the wrong-language gloss.

export type ExplanationHit = { explain: boolean; text: string };

const cache = new Map<string, ExplanationHit>();
const inflight = new Map<string, Promise<ExplanationHit>>();

type Pending = { key: string; text: string; resolve: (h: ExplanationHit) => void };
let queue: Pending[] = [];
let flushTimer: number | null = null;
let queueLang: string | null = null;

const FLUSH_DELAY_MS = 100;
const MAX_BATCH = 50;

const EMPTY: ExplanationHit = { explain: false, text: "" };

function cacheKey(text: string, lang: string): string {
  return `${lang}\n${text}`;
}

export function requestExplanation(
  text: string,
  lang: "en" | "lt",
): Promise<ExplanationHit> {
  if (!text) return Promise.resolve(EMPTY);
  const key = cacheKey(text, lang);
  const cached = cache.get(key);
  if (cached) return Promise.resolve(cached);
  const flying = inflight.get(key);
  if (flying) return flying;

  const p = new Promise<ExplanationHit>((resolve) => {
    // Queue may only carry one lang at a time; a lang switch flushes
    // the current batch immediately so the in-flight one keeps its
    // language and the new queue starts fresh.
    if (queueLang && queueLang !== lang) flushNow();
    queueLang = lang;
    queue.push({ key, text, resolve });
    if (queue.length >= MAX_BATCH) {
      flushNow();
    } else if (flushTimer == null) {
      flushTimer = window.setTimeout(flushNow, FLUSH_DELAY_MS);
    }
  });
  inflight.set(key, p);
  return p;
}

function flushNow(): void {
  if (flushTimer != null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  const batch = queue;
  const lang = queueLang;
  queueLang = null;
  if (batch.length === 0 || !lang) return;
  queue = [];

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

  fetch("/api/explain", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ texts: uniq, lang }),
  })
    .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
    .then((data: { results?: ExplanationHit[] }) => {
      const results = data.results ?? [];
      for (let i = 0; i < uniq.length; i++) {
        const text = uniq[i];
        const hit = results[i] ?? EMPTY;
        cache.set(cacheKey(text, lang), hit);
        for (const w of waiters.get(text) ?? []) {
          inflight.delete(w.key);
          w.resolve(hit);
        }
      }
    })
    .catch(() => {
      for (const text of uniq) {
        for (const w of waiters.get(text) ?? []) {
          inflight.delete(w.key);
          w.resolve(EMPTY);
        }
      }
    });
}
