import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { createHash } from "node:crypto";
import { z } from "zod";
import * as zv4 from "zod/v4";
import { sql } from "drizzle-orm";
import { readSignedSessionId } from "@/lib/server-session";
import { checkAndIncrement } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { chatHelperCache } from "@/lib/db/schema";

// POST /api/explain
//
// Body: { texts: string[] (≤50), lang: "en" | "lt" }
//
// Returns: { results: { explain, text }[] }
//
// Powers the "beginner mode" toggle. For each candidate chat message,
// the Anthropic nano-class model (Haiku 4.5 by default) decides whether
// it contains a Eurovision-specific reference (a past contestant, a
// running joke, voting trivia, a country quirk) and writes a brief
// gloss in the user's UI language. Caching tiers:
//
//   1. in-memory map           — fast path inside a warm serverless instance
//   2. chat_helper_cache table — durable, shared across instances + langs
//   3. Anthropic batch call    — only when both miss
//
// kind="beginner" rows in chat_helper_cache are global to the install
// (same input + same lang → same explanation), so heavy use across many
// rooms shares one set of cached gloss.

const Body = z.object({
  texts: z.array(z.string().min(1).max(2000)).min(1).max(50),
  lang: z.enum(["en", "lt"]),
});

const Item = zv4.object({
  index: zv4
    .number()
    .int()
    .describe("Zero-based index of the input message this result corresponds to."),
  explain: zv4
    .boolean()
    .describe("true if the message contains a Eurovision-specific reference worth glossing"),
  text: zv4
    .string()
    .describe(
      "When explain=true, a short (≤200 chars) explanation in the target language. When explain=false, empty string.",
    ),
});
const Batch = zv4.object({
  results: zv4.array(Item),
});

type CachedHit = { explain: boolean; text: string };

// L1 — in-memory, per warm instance. Key = `${lang}\n${textKey}`.
const memCache = new Map<string, CachedHit>();
const MAX_MEM = 2000;
function memGet(k: string): CachedHit | null {
  return memCache.get(k) ?? null;
}
function memSet(k: string, hit: CachedHit): void {
  memCache.set(k, hit);
  if (memCache.size > MAX_MEM) {
    const oldest = memCache.keys().next().value;
    if (oldest) memCache.delete(oldest);
  }
}

const EMPTY: CachedHit = { explain: false, text: "" };
const KIND = "beginner";

function hashText(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function systemPrompt(lang: "en" | "lt"): string {
  const target = lang === "lt" ? "Lithuanian" : "English";
  return [
    `You help a Eurovision newcomer follow a watch-party chat. Output language: ${target}.`,
    "Input: a JSON array of chat messages, each `{ index, text }`.",
    "Output: a `results` array with ONE entry per input. Each entry MUST include the matching `index`. Include every index exactly once.",
    "Decide whether the message contains a Eurovision-specific reference: a past contestant or song, a running joke (Cha Cha Cha, nul points, dancing grannies, key change), a juror/televote quirk, a host-country bit, the Big Five, Junior Eurovision, the dress rehearsal lore. Casual mentions of a current artist on stage usually do NOT need a gloss — only background context does.",
    `If a reference is present, set explain=true and write a concise ${target} gloss (≤200 chars) that an outsider would understand. Skip if the message is plain reaction (\"🔥\", \"go!\", \"omg\") or trivially clear.`,
    'If no Eurovision-specific reference, set explain=false and text="".',
    "Do not editorialise or repeat the message back. One gloss per item, no list bullets.",
  ].join("\n");
}

let cachedClient: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (cachedClient) return cachedClient;
  if (!process.env.ANTHROPIC_API_KEY) return null;
  cachedClient = new Anthropic();
  return cachedClient;
}

// Bulk-load durable cache rows for the (kind, lang, textKey[]) tuple.
// Returns a Map<textKey, CachedHit>. Best-effort: any DB error just
// returns an empty map and the call falls through to Anthropic.
async function dbLoadMany(
  textKeys: string[],
  lang: string,
): Promise<Map<string, CachedHit>> {
  const out = new Map<string, CachedHit>();
  if (textKeys.length === 0) return out;
  try {
    const rows = await db
      .select({ textKey: chatHelperCache.textKey, payload: chatHelperCache.payload })
      .from(chatHelperCache)
      .where(
        sql`${chatHelperCache.kind} = ${KIND}
            AND ${chatHelperCache.lang} = ${lang}
            AND ${chatHelperCache.textKey} = ANY(${textKeys})`,
      );
    for (const r of rows) {
      const payload = r.payload as Record<string, unknown>;
      const hit: CachedHit = {
        explain: !!payload.explain,
        text: typeof payload.text === "string" ? payload.text : "",
      };
      out.set(r.textKey, hit);
    }
    // Best-effort hit bump so cold rows can be evicted later. Fire and
    // forget — failure doesn't break the response path.
    if (rows.length > 0) {
      const keys = rows.map((r) => r.textKey);
      db.execute(
        sql`UPDATE chat_helper_cache
            SET hits = hits + 1, updated_at = now()
            WHERE kind = ${KIND} AND lang = ${lang}
              AND text_key = ANY(${keys})`,
      ).catch(() => {});
    }
  } catch (err) {
    console.warn("[explain] db load", err);
  }
  return out;
}

// Persist one row per (textKey, lang) with payload = { explain, text }.
// ON CONFLICT keeps existing hits + updated_at refresh; the row was
// already there if a concurrent request hit the same text first.
async function dbStoreMany(
  rows: { textKey: string; payload: CachedHit }[],
  lang: string,
): Promise<void> {
  if (rows.length === 0) return;
  try {
    for (const r of rows) {
      await db.execute(
        sql`INSERT INTO chat_helper_cache (kind, text_key, lang, payload)
            VALUES (${KIND}, ${r.textKey}, ${lang}, ${JSON.stringify(r.payload)}::jsonb)
            ON CONFLICT (kind, text_key, lang) DO UPDATE
              SET payload = EXCLUDED.payload,
                  hits   = chat_helper_cache.hits + 1,
                  updated_at = now()`,
      );
    }
  } catch (err) {
    console.warn("[explain] db store", err);
  }
}

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { texts, lang } = parsed.data;

  // Per-text routing tables: original index → final hit, plus the list
  // of unique-uncached texts we'll actually send to the model.
  const results: CachedHit[] = new Array<CachedHit>(texts.length).fill(EMPTY);
  const textKeys = texts.map(hashText);
  const missingText: string[] = [];
  const missingKeys: string[] = [];
  const missingIdx: number[] = [];
  const firstOccurrence = new Map<string, number>();

  // L1 — in-memory.
  const dbCandidateKeys: string[] = [];
  const dbCandidateIdx: number[] = [];
  for (let i = 0; i < texts.length; i++) {
    const memKey = `${lang}\n${textKeys[i]}`;
    const m = memGet(memKey);
    if (m) {
      results[i] = m;
      continue;
    }
    if (firstOccurrence.has(textKeys[i])) continue;
    firstOccurrence.set(textKeys[i], i);
    dbCandidateKeys.push(textKeys[i]);
    dbCandidateIdx.push(i);
  }

  // L2 — durable. Hydrate L1 from any hits + queue the rest for Anthropic.
  if (dbCandidateKeys.length > 0) {
    const fromDb = await dbLoadMany(dbCandidateKeys, lang);
    for (let i = 0; i < dbCandidateKeys.length; i++) {
      const key = dbCandidateKeys[i];
      const idx = dbCandidateIdx[i];
      const hit = fromDb.get(key);
      if (hit) {
        memSet(`${lang}\n${key}`, hit);
        results[idx] = hit;
      } else {
        missingText.push(texts[idx]);
        missingKeys.push(key);
        missingIdx.push(idx);
      }
    }
  }

  if (missingText.length > 0) {
    const session = await readSignedSessionId();
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const bucket = `explain:${session ?? `ip:${ip}`}`;
    // ONE bucket tick per batch — matches translate's policy.
    const limited = await checkAndIncrement(
      bucket,
      session ? 240 : 60,
      60_000,
    );
    if (limited.ok) {
      const client = getClient();
      if (client) {
        try {
          const payload = JSON.stringify(
            missingText.map((text, index) => ({ index, text })),
          );
          const maxTokens = Math.min(256 + missingText.length * 200, 4096);
          const response = await client.messages.parse({
            model: process.env.ANTHROPIC_EXPLAIN_MODEL ?? "claude-haiku-4-5",
            max_tokens: maxTokens,
            system: systemPrompt(lang),
            messages: [{ role: "user", content: payload }],
            output_config: { format: zodOutputFormat(Batch) },
          });
          const parsedBatch = Batch.safeParse(response.parsed_output);
          if (parsedBatch.success) {
            const placed = new Set<number>();
            const toStore: { textKey: string; payload: CachedHit }[] = [];
            for (const r of parsedBatch.data.results) {
              const idx = r.index;
              if (idx < 0 || idx >= missingText.length || placed.has(idx)) continue;
              placed.add(idx);
              const hit: CachedHit = {
                explain: !!r.explain,
                text: r.explain ? (r.text ?? "").slice(0, 240) : "",
              };
              memSet(`${lang}\n${missingKeys[idx]}`, hit);
              results[missingIdx[idx]] = hit;
              toStore.push({ textKey: missingKeys[idx], payload: hit });
            }
            // Anything the model skipped → cache EMPTY so we don't ask
            // again about the same near-empty inputs forever.
            for (let j = 0; j < missingText.length; j++) {
              if (!placed.has(j)) {
                memSet(`${lang}\n${missingKeys[j]}`, EMPTY);
                toStore.push({ textKey: missingKeys[j], payload: EMPTY });
              }
            }
            // Persist asynchronously so the response isn't blocked on
            // the durable write.
            void dbStoreMany(toStore, lang);
          } else {
            console.warn(
              "[explain] schema mismatch",
              JSON.stringify(response.parsed_output)?.slice(0, 300),
            );
          }
        } catch (err) {
          if (err instanceof Anthropic.APIError) {
            console.warn("[explain] anthropic", err.status, err.message);
          } else {
            console.warn("[explain] unexpected", err);
          }
        }
      }
    }
  }

  // Backfill duplicate slots within the request from in-memory cache.
  for (let i = 0; i < texts.length; i++) {
    if (results[i] === EMPTY) {
      const m = memGet(`${lang}\n${textKeys[i]}`);
      if (m) results[i] = m;
    }
  }

  return NextResponse.json({ results });
}

export const dynamic = "force-dynamic";
