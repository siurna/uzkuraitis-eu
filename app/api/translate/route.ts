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
// Returns: { results: { translate, text }[] }   (parallel array, same length as texts)
//   or     { translate, text }                  (when called with { text })
//
// Powers the "auto-translate to English" toggle. Each candidate chat
// message goes through Anthropic's nano-class model (Haiku 4.5 by
// default) which decides whether an English speaker would benefit
// from a rendering.
//
// PERF: ONE Anthropic call per batch. The client (lib/translate-
// batcher) folds bubbles inside a 100ms window into a single fetch,
// and this route packs all the unique-uncached texts into a single
// structured-output prompt. The model returns a parallel array of
// `{ index, translate, text }` — we use `index` to route each result
// back to its slot (so partial / out-of-order responses still place
// correctly instead of silently zeroing the whole batch).

const Body = z.union([
  z.object({ texts: z.array(z.string().min(1).max(2000)).min(1).max(50) }),
  z.object({ text: z.string().min(1).max(2000) }),
]);

// Per-text output shape. `index` lets the model address each input by
// position regardless of order — defensive against the rare case where
// the model elides a row.
const Item = zv4.object({
  index: zv4
    .number()
    .int()
    .describe("Zero-based index of the input message this result corresponds to."),
  translate: zv4
    .boolean()
    .describe("true if a non-English speaker would benefit from a rendering"),
  text: zv4
    .string()
    .describe(
      "When translate=true, a concise English rendering (≤200 chars). When translate=false, empty string.",
    ),
});
const Batch = zv4.object({
  results: zv4.array(Item),
});

type CachedHit = { translate: boolean; text: string };

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
  "Input: a JSON array of chat messages, each item is `{ index, text }`.",
  "Output: a `results` array with ONE entry per input message. Each entry MUST include the matching `index` from the input so the caller can map them back. You may return them in any order, but include EVERY index from the input exactly once.",
  "",
  "Per-message rules:",
  '- Message is already clear, idiomatic English with no Lithuanian content AND carries no Lithuanian cultural reference → set translate=false and text="". (Most short reactions, "yes!", emoji, etc.)',
  "- Message is in Lithuanian, OR mixes Lithuanian + English → set translate=true. `text` starts with a concise English rendering of the literal meaning, then a [bracketed Lithuanian-context note] when the message hangs on something an outsider wouldn't catch (a TV show, a politician, a meme, a slang word, an in-joke).",
  '- Message is already in fluent English BUT contains a Lithuanian-specific reference an outsider would miss (a Lithuanian band, dish, TV show, region, idiom-in-English, etc.) → keep translate=false BUT put the explanation in `text`. We render it as a context bubble next to the original message instead of as a translation. Example: input "feels like watching TELELOTO" → translate=false, text="[Teleloto is the Saturday-night Lithuanian lottery game show: glittery hosts, audience guests, big spinning ball. The line means the broadcast feels cheesy/old-school national-TV in that specific way.]".',
  "",
  "When you include a [bracketed Lithuanian-context note]:",
  "- Be SPECIFIC. Name names, years, the actual show/song/dish/politician. Vague hand-waving (\"a Lithuanian TV show\") doesn't help — \"Teleloto, the Saturday-night LT lottery game show\" does.",
  "- Explain WHY the reference is relevant to the line and to Eurovision. Two sentences are fine when the context is non-obvious.",
  "- If you only half-recognise the reference, say so honestly (\"likely a reference to X, though I'm not sure\") rather than invent.",
  "- Each `text` ≤ 320 chars total.",
  "",
  "Never editorialise, never repeat the message back, never include the speaker's name. Skip single emojis, single English words, plain reactions.",
].join("\n");

let cachedClient: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (cachedClient) return cachedClient;
  if (!process.env.ANTHROPIC_API_KEY) return null;
  cachedClient = new Anthropic();
  return cachedClient;
}

async function _handlePost(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const body = parsed.data;
  const isSingle = "text" in body;
  const texts = isSingle ? [body.text] : body.texts;

  // Cache + dedupe pass. We end up with:
  //   - results[]   : final response slot per input text
  //   - missingText : unique texts to actually send to the model
  //   - missingIdx  : the FIRST input-array index for each missingText
  const results: CachedHit[] = new Array<CachedHit>(texts.length).fill(EMPTY);
  const missingText: string[] = [];
  const missingIdx: number[] = [];
  const firstOccurrence = new Map<string, number>();

  for (let i = 0; i < texts.length; i++) {
    const t = texts[i];
    const cached = cacheGet(t);
    if (cached) {
      results[i] = cached;
      continue;
    }
    if (firstOccurrence.has(t)) continue; // duplicate, will backfill
    firstOccurrence.set(t, i);
    missingText.push(t);
    missingIdx.push(i);
  }

  if (missingText.length > 0) {
    const session = await readSignedSessionId();
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const bucket = `translate:${session ?? `ip:${ip}`}`;
    // ONE bucket tick per batch, not per text. With batching a busy
    // room of 30 viewers refreshing translate at once burns ~30 ticks/
    // minute total instead of 30 × N.
    const limited = await checkAndIncrement(
      bucket,
      session ? 240 : 60,
      60_000,
    );
    if (limited.ok) {
      const client = getClient();
      if (client) {
        try {
          // Pack the batch as an indexed JSON array. The model returns
          // a parallel `results: [{ index, translate, text }, ...]`.
          const payload = JSON.stringify(
            missingText.map((text, index) => ({ index, text })),
          );
          // Token budget: ~200 tokens per response item + 256 overhead,
          // capped at 4096 (Haiku's headroom is fine here).
          const maxTokens = Math.min(256 + missingText.length * 200, 4096);
          const response = await client.messages.parse({
            model: process.env.ANTHROPIC_TRANSLATE_MODEL ?? "claude-haiku-4-5",
            max_tokens: maxTokens,
            system: SYSTEM_PROMPT,
            messages: [{ role: "user", content: payload }],
            output_config: { format: zodOutputFormat(Batch) },
          });
          const parsedBatch = Batch.safeParse(response.parsed_output);
          if (parsedBatch.success) {
            // Index-routed application — partial / re-ordered model
            // output still lands in the correct slots. Anything the
            // model skipped stays EMPTY and gets cached EMPTY (so we
            // don't hammer for the same near-empty inputs forever).
            const placed = new Set<number>();
            for (const r of parsedBatch.data.results) {
              const idx = r.index;
              if (idx < 0 || idx >= missingText.length || placed.has(idx)) continue;
              placed.add(idx);
              const hit: CachedHit = {
                translate: !!r.translate,
                text: r.translate ? (r.text ?? "").slice(0, 240) : "",
              };
              cacheSet(missingText[idx], hit);
              results[missingIdx[idx]] = hit;
            }
            // Any text the model didn't address → cache EMPTY so we
            // don't call again. (Almost always means "already English,
            // no rendering needed".)
            for (let j = 0; j < missingText.length; j++) {
              if (!placed.has(j)) cacheSet(missingText[j], EMPTY);
            }
          } else {
            console.warn(
              "[translate] schema mismatch",
              JSON.stringify(response.parsed_output)?.slice(0, 300),
            );
          }
        } catch (err) {
          if (err instanceof Anthropic.APIError) {
            console.warn("[translate] anthropic", err.status, err.message);
          } else {
            console.warn("[translate] unexpected", err);
          }
        }
      }
    }
  }

  // Backfill duplicate slots — the first occurrence is now in cache.
  for (let i = 0; i < texts.length; i++) {
    if (results[i] === EMPTY) {
      const cached = cacheGet(texts[i]);
      if (cached) results[i] = cached;
    }
  }

  if (isSingle) return NextResponse.json(results[0] ?? EMPTY);
  return NextResponse.json({ results });
}

// Thin wrapper so any uncaught throw inside the handler comes back as a
// structured 500 instead of an empty body. The empty-body 500 we were
// seeing in prod was Next.js's default for an unhandled rejection, which
// hid the actual error — surface it.
export async function POST(req: Request) {
  try {
    return await _handlePost(req);
  } catch (err) {
    console.error("[translate] fatal", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
