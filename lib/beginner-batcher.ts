"use client";

// Module-level batcher for /api/explain (beginner-mode Eurovision
// reference helper). Same shape as translate-batcher: every
// <BeginnerBubble> calls `requestExplanation(text, lang, nowCountry?)`
// and a queue flushes after a 100ms quiet window (or when 50 distinct
// texts are piled up). Cache key folds in `lang + nowCountry + text`
// so the same line gets a different gloss as the on-stage country
// changes (the server resolves nowCountry → recent entries from
// lib/eurovision-history and threads them into the prompt).

export type ExplanationHit = { explain: boolean; text: string };

const cache = new Map<string, ExplanationHit>();
const inflight = new Map<string, Promise<ExplanationHit>>();

type Pending = { key: string; text: string; resolve: (h: ExplanationHit) => void };
type QueueScope = { lang: string; nowCountry: string | null };
let queue: Pending[] = [];
let flushTimer: number | null = null;
let queueScope: QueueScope | null = null;

const FLUSH_DELAY_MS = 100;
const MAX_BATCH = 50;

const EMPTY: ExplanationHit = { explain: false, text: "" };

function cacheKey(text: string, lang: string, nowCountry: string | null): string {
  return `${lang}\n${nowCountry ?? "lore"}\n${text}`;
}

function scopesEq(a: QueueScope, b: QueueScope): boolean {
  return a.lang === b.lang && a.nowCountry === b.nowCountry;
}

export function requestExplanation(
  text: string,
  lang: "en" | "lt",
  nowCountry?: string | null,
): Promise<ExplanationHit> {
  if (!text) return Promise.resolve(EMPTY);
  const country = nowCountry ?? null;
  const key = cacheKey(text, lang, country);
  const cached = cache.get(key);
  if (cached) return Promise.resolve(cached);
  const flying = inflight.get(key);
  if (flying) return flying;

  const p = new Promise<ExplanationHit>((resolve) => {
    const scope: QueueScope = { lang, nowCountry: country };
    // Queue can only carry one (lang, country) pair at a time. A
    // change in either flushes the existing batch immediately so the
    // in-flight one keeps its scope and the new queue starts fresh.
    if (queueScope && !scopesEq(queueScope, scope)) flushNow();
    queueScope = scope;
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
  const scope = queueScope;
  queueScope = null;
  if (batch.length === 0 || !scope) return;
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
    body: JSON.stringify({
      texts: uniq,
      lang: scope.lang,
      ctx: scope.nowCountry ? { nowCountry: scope.nowCountry } : undefined,
    }),
  })
    .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
    .then((data: { results?: ExplanationHit[] }) => {
      const results = data.results ?? [];
      for (let i = 0; i < uniq.length; i++) {
        const text = uniq[i];
        const hit = results[i] ?? EMPTY;
        cache.set(cacheKey(text, scope.lang, scope.nowCountry), hit);
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
