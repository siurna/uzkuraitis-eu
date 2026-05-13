import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import * as zv4 from "zod/v4";
import { readSignedSessionId } from "@/lib/server-session";
import { checkAndIncrement } from "@/lib/rate-limit";

// POST /api/translate
//
// Body: { texts: string[] }   (≤ 50 per call)
//   or  { text: string }      (single-text legacy form, kept for old clients)
//
// Returns: { results: TranslationResult[] }     (parallel array)
//   or     { translate, text }                  (when called with single `text`)
//
// Powers the "auto-translate to English" toggle. Each candidate chat
// message goes through Anthropic's nano-class model (Haiku 4.5 by
// default) which decides whether an English speaker would benefit from
// a rendering. Pure English passes through; Lithuanian or Lithuanian-
// flavoured slang gets a concise English rendering with optional
// bracketed cultural notes.
//
// PERF: the client batches requests in a 100ms window and sends one
// POST per batch. The route folds duplicates server-side, hits the
// in-memory cache for known texts, and only sends the leftover
// uncached texts to the model in a SINGLE structured-output call. A
// 50-message chat-scroll-back collapses from 50 round-trips and 50
// model invocations into 1 round-trip and 1 invocation.
//
// Requires ANTHROPIC_API_KEY. Without it, the endpoint soft-fails to
// `{ translate: false, text: "" }` (or its array form) so the feature
// degrades cleanly. Override the model via ANTHROPIC_TRANSLATE_MODEL.

const Body = z.union([
  z.object({ texts: z.array(z.string().min(1).max(2000)).min(1).max(50) }),
  z.object({ text: z.string().min(1).max(2000) }),
]);

const TranslationResult = zv4.object({
  translate: zv4
    .boolean()
    .describe("true if a non-English speaker would benefit from the rendering"),
  text: zv4
    .string()
    .describe(
      "When translate=true, a concise English rendering (≤200 chars). When translate=false, an empty string.",
    ),
});

// The server prompt asks the model to return ONE result per input
// message in input order. We wrap an array on the structured-output
// schema so a single call returns parallel results for the whole batch.
const TranslationBatch = zv4.object({
  results: zv4.array(TranslationResult).min(1).max(50),
});

type CachedHit = zv4.infer<typeof TranslationResult>;

const cache = new Map<string, CachedHit>();
const MAX_CACHE = 2000;

function cacheGet(key: string): CachedHit | null {
  return cache.get(key) ?? null;
}
function cacheSet(key: string, hit: CachedHit): void {
  cache.set(key, hit);
  if (cache.size > MAX_CACHE) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
}

const EMPTY: CachedHit = { translate: false, text: "" };

const SYSTEM_PROMPT = [
  "You help an English-speaking viewer follow a Lithuanian Eurovision watch-party chat.",
  "You are given a JSON array of chat messages. For EACH one, decide whether an English speaker would benefit from a translation or cultural unpack.",
  "Return a `results` array with ONE entry per input message, in the same order.",
  "Per-message rules:",
  '- If the message is already clear, idiomatic English without Lithuanian content, set translate=false and text="".',
  "- If it contains Lithuanian text, or Lithuanian-specific slang/cultural references that an English speaker wouldn't catch, set translate=true and text to a concise English rendering.",
  "- For cultural references, you may add a short [bracketed note] after the rendering. Keep each `text` under 200 characters.",
  "- Don't translate single emoji, single English words, or already-English phrases. Don't editorialise.",
].join("\n");

let cachedClient: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (cachedClient) return cachedClient;
  if (!process.env.ANTHROPIC_API_KEY) return null;
  cachedClient = new Anthropic();
  return cachedClient;
}

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  // Normalise both shapes to a `texts: string[]` working list, remember
  // which shape was sent so we mirror it back.
  const body = parsed.data;
  const isSingle = "text" in body;
  const texts = isSingle ? [body.text] : body.texts;

  // Build the response array slot-by-slot. Cache hits fill in
  // immediately; misses get queued for one model call.
  const results: CachedHit[] = new Array(texts.length).fill(null) as never;
  const missingIdx: number[] = [];
  const missingText: string[] = [];
  const seenInBatch = new Map<string, number>(); // text → index of FIRST occurrence

  for (let i = 0; i < texts.length; i++) {
    const t = texts[i];
    const fromCache = cacheGet(t);
    if (fromCache) {
      results[i] = fromCache;
      continue;
    }
    // Same text twice in one batch: only model-call it once, point both
    // slots at the eventual answer.
    const seen = seenInBatch.get(t);
    if (seen != null) {
      // Marker; we'll backfill after the model returns.
      results[i] = { translate: false, text: "" };
      continue;
    }
    seenInBatch.set(t, i);
    missingIdx.push(i);
    missingText.push(t);
  }

  // If everything was a cache hit, skip auth / rate-limit / model
  // entirely — fastest path.
  if (missingText.length > 0) {
    const session = await readSignedSessionId();
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const usingSession = !!session;
    const bucket = `translate:${session ?? `ip:${ip}`}`;
    // The bucket counts ONE per actual model call (i.e. per fresh batch
    // request that needs the model), not per text. With batching the
    // limit becomes "240 model calls per minute" which is effectively
    // unreachable for a normal chat session.
    const limited = await checkAndIncrement(
      bucket,
      usingSession ? 240 : 60,
      60_000,
    );
    if (limited) {
      // Fill all the misses with EMPTY so the client renders nothing
      // for them, but doesn't break.
      for (const i of missingIdx) results[i] = EMPTY;
    } else {
      const client = getClient();
      if (!client) {
        // Soft-fail when the API key isn't configured.
        for (const i of missingIdx) results[i] = EMPTY;
      } else {
        try {
          // Pack the missing texts as a numbered list inside the user
          // message — Anthropic's structured-output runner returns the
          // parallel array via `parsed_output.results`.
          const userPayload = JSON.stringify(missingText);
          const response = await client.messages.parse({
            model: process.env.ANTHROPIC_TRANSLATE_MODEL ?? "claude-haiku-4-5",
            max_tokens: Math.min(256 + missingText.length * 256, 4096),
            system: SYSTEM_PROMPT,
            messages: [{ role: "user", content: userPayload }],
            output_config: { format: zodOutputFormat(TranslationBatch) },
          });
          const parsedBatch = TranslationBatch.safeParse(response.parsed_output);
          if (
            !parsedBatch.success ||
            parsedBatch.data.results.length !== missingText.length
          ) {
            // Length mismatch is rare but possible if the model goes off
            // script. Fail soft for ALL misses — better silence than
            // wrong-row translations.
            for (const i of missingIdx) results[i] = EMPTY;
          } else {
            for (let j = 0; j < missingText.length; j++) {
              const t = missingText[j];
              const r = parsedBatch.data.results[j];
              const hit: CachedHit = {
                translate: !!r.translate,
                text: r.translate ? (r.text ?? "").slice(0, 240) : "",
              };
              cacheSet(t, hit);
              results[missingIdx[j]] = hit;
            }
          }
        } catch (err) {
          if (err instanceof Anthropic.APIError) {
            console.warn("[translate] anthropic", err.status, err.message);
          } else {
            console.warn("[translate] unexpected", err);
          }
          for (const i of missingIdx) results[i] = EMPTY;
        }
      }
    }
  }

  // Fill the dedupe slots: any text that appeared multiple times in the
  // batch shares the cached result.
  for (let i = 0; i < texts.length; i++) {
    if (!results[i] || results[i].translate === false && results[i].text === "" && cacheGet(texts[i])) {
      const c = cacheGet(texts[i]);
      if (c) results[i] = c;
    }
  }

  if (isSingle) return NextResponse.json(results[0] ?? EMPTY);
  return NextResponse.json({ results });
}

export const dynamic = "force-dynamic";
