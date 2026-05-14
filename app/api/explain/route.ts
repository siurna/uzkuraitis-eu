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
import { getCountry } from "@/lib/countries";
import { getRecentEntries, type HistoricalEntry } from "@/lib/eurovision-history";

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

// Optional live context — when the client passes `nowCountry`, the
// route looks up the country's name + recent entries server-side
// (the client doesn't need to ship the whole history table). Used
// in the prompt so the LLM can say "Tonight's Italian entry follows
// Måneskin 2021…" instead of "this country often…".
const Body = z.object({
  texts: z.array(z.string().min(1).max(2000)).min(1).max(50),
  lang: z.enum(["en", "lt"]),
  ctx: z
    .object({
      nowCountry: z
        .string()
        .toLowerCase()
        .regex(/^[a-z]{2}$/)
        .optional(),
      nowYear: z.number().int().min(2000).max(2100).optional(),
    })
    .optional(),
});

type LiveCtx = {
  nowCountry: string;
  nowYear: number;
  nowCountryName: string | null;
  nowArtist: string | null;
  nowSong: string | null;
  recent: HistoricalEntry[];
};

function resolveCtx(input: { nowCountry?: string; nowYear?: number } | undefined): LiveCtx | null {
  if (!input?.nowCountry) return null;
  const c = getCountry(input.nowCountry);
  return {
    nowCountry: input.nowCountry,
    nowYear: input.nowYear ?? new Date().getFullYear(),
    nowCountryName: c?.name ?? null,
    nowArtist: c?.artist ?? null,
    nowSong: c?.song ?? null,
    recent: getRecentEntries(input.nowCountry).slice(0, 5),
  };
}

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

// Cache fingerprint. The scope is folded into the digest so the
// durable chat_helper_cache table (keyed on `(kind, text_key, lang)`)
// stays unchanged: a "live:se" answer for the same text gets a
// different text_key than the global "lore" answer, instead of
// overwriting each other.
function hashText(text: string, scope: string): string {
  return createHash("sha256").update(scope).update("\n").update(text).digest("hex");
}

function systemPrompt(lang: "en" | "lt", ctx: LiveCtx | null): string {
  const target = lang === "lt" ? "Lithuanian" : "English";
  // When the client passes `ctx`, give the model a small structured
  // brief of the moment — who's on stage right now + that country's
  // most recent entries — so it can land "Tonight's Italian entry
  // follows Måneskin 2021…" callbacks instead of generic filler.
  const ctxBlock = ctx
    ? [
        "",
        "LIVE CONTEXT (use this — names are authoritative, do NOT contradict it):",
        `- Right now (${ctx.nowYear}): ${ctx.nowCountryName ?? ctx.nowCountry.toUpperCase()} is on stage with ${ctx.nowArtist ?? "an artist"}${ctx.nowSong ? `, "${ctx.nowSong}"` : ""}.`,
        ctx.recent.length > 0
          ? `- ${ctx.nowCountryName ?? ctx.nowCountry.toUpperCase()}'s last entries: ${ctx.recent
              .map(
                (e) =>
                  `${e.year} ${e.artist}, "${e.song}"${e.placement != null ? ` (#${e.placement})` : ""}`,
              )
              .join("; ")}.`
          : `- I don't have ${ctx.nowCountryName ?? ctx.nowCountry.toUpperCase()}'s recent entries cached; if you're not sure, say so plainly instead of inventing.`,
        "When a line is about the current performer or that country, USE these names. \"Reminds me of last year's Italy\" → name the actual prior-year entry from the list above.",
        "",
      ].join("\n")
    : "";
  return [
    `You help someone follow a Lithuanian Eurovision watch-party chat. Output language: ${target}.`,
    "Input: a JSON array `{ index, text }`. Output: `{ results: [{ index, explain, text }] }`, exactly one entry per input, indices unique.",
    ctxBlock,
    "",
    "STEP 1. Does this line hang on a SPECIFIC, NAMED Eurovision fact a newcomer can be handed and remember? Real facts only — named artists, named songs, real placements, real years, real running jokes.",
    "",
    "ELIGIBLE FUEL (use this kind of thing — never less specific):",
    "- A named past act + year + country: \"Lordi 2006 FI, Hard Rock Hallelujah.\" \"Måneskin 2021 IT, Zitti e buoni.\" \"Salvador Sobral 2017 PT, Amar pelos dois.\" \"Käärijä 2023 FI, Cha Cha Cha.\" \"Loreen 2012 + 2023 SE.\" \"Conchita Wurst 2014 AT, Rise Like a Phoenix.\" \"Netta 2018 IL, Toy.\" \"Verka Serduchka 2007 UA, Dancing Lasha Tumbai.\"",
    "- Named running joke / EBU fact: the \"death slot\" (second in the order), the Big Five auto-qualifiers, jury-vs-televote 50/50 split, the postcard between acts, Cyprus and Greece swapping 12 points, Sweden's hit-factory pipeline, Italy's Sanremo qualifier, San Marino fielding outside acts. Each of these IS a fact you can drop.",
    "- A specific LT cultural reference (LT slang, Lithuanian internet meme, Lithuanian moment in the contest like LT United 2006 \"We Are the Winners\", Donny Montell, The Roop \"Discoteque\", Monika Linkytė \"Stay\", Silvester Belt, Katarsis).",
    "",
    "NEVER ELIGIBLE — skip every time with explain=false, text=\"\":",
    "- Anything that could plausibly be said about ANY country (\"swap test\"). \"This country often sends memorable entries\" → swap any country in, still works → skip.",
    "- Filler vocabulary: \"the performer's stage presence is striking\", \"comparison suggests similar aesthetic or fashion choices\", \"this is a reference to a past performer\", \"hints at a stylistic comparison\". These are BANNED phrases. If your draft contains them, set explain=false.",
    "- \"Iconic\", \"fierce\", \"serving\", \"slay\" as standalone descriptions. Skip.",
    "- Any output that has ZERO proper nouns and ZERO years. Hard rule.",
    "- Casual chat reactions (\"🔥\", \"go!\", \"omg\", \"this slaps\", \"so good\").",
    "",
    "STEP 2. Write the gloss only if you cleared Step 1:",
    `- In ${target}. 1 to 3 sentences, ≤280 chars. No em dashes — use a comma or a period.`,
    "- Format: [the fact, with a name + year + country] + [why that ties to the line].",
    "- Lead with the named entry, not the country. \"Loreen won twice for Sweden, 2012 Euphoria and 2023 Tattoo\" beats \"Sweden has a strong Eurovision history\".",
    "- If the line names a year + country and you cannot CONFIDENTLY pin the actual entry, do not invent. Say so plainly in the target language: \"I don't have that exact entry on hand, but [country] sent [one named entry you do know].\"",
    "",
    "GOOD examples (study the shape):",
    "- \"Loreen wins twice for Sweden, 2012 with Euphoria and 2023 with Tattoo. She's the only artist with two trophies, which is why every Swedish ballad gets compared back to her.\"",
    "- \"Italy's Måneskin won 2021 with Zitti e buoni and turned into the biggest post-Eurovision rock export of the decade. The line means tonight's Italian entry is fishing in the same glam-rock lane.\"",
    "- \"Verka Serduchka was Ukraine's 2007 act, a drag persona in a foil cone hat with Dancing Lasha Tumbai. 'Pulling a Verka' means leaning all the way into camp / comedy.\"",
    "",
    "BAD examples (do not emit anything that reads like these):",
    "- \"Comparison suggests the current performer shares similar aesthetic or fashion choices.\" → vague, swap test fails, banned phrasing. Skip.",
    "- \"This country often sends memorable entries.\" → swap test fails. Skip.",
    "- \"The performer's stage presence is striking.\" → could be any act. Skip.",
    "- \"Latvia had a yellow visual aesthetic.\" → invented filler. Skip.",
    "",
    "REMEMBER: honest \"explain=false\" is better than a lame \"explain=true\" with empty filler. If your output doesn't include a proper noun + (a year OR a named running joke), set explain=false.",
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

async function _handlePost(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { texts, lang } = parsed.data;
  const ctx = resolveCtx(parsed.data.ctx);
  // Cache scope: when the client gives us a live nowCountry, the
  // answer depends on who's on stage right now — fold the country
  // into the cache key so a "this country" gloss for Sweden doesn't
  // serve when Italy's on stage. No ctx → "lore" entries share
  // across every room.
  const cacheScope = ctx ? `live:${ctx.nowCountry}` : "lore";
  const keyOf = (textKey: string) => `${lang}\n${cacheScope}\n${textKey}`;

  // Per-text routing tables: original index → final hit, plus the list
  // of unique-uncached texts we'll actually send to the model.
  const results: CachedHit[] = new Array<CachedHit>(texts.length).fill(EMPTY);
  const textKeys = texts.map((t) => hashText(t, cacheScope));
  const missingText: string[] = [];
  const missingKeys: string[] = [];
  const missingIdx: number[] = [];
  const firstOccurrence = new Map<string, number>();

  // L1 — in-memory.
  const dbCandidateKeys: string[] = [];
  const dbCandidateIdx: number[] = [];
  for (let i = 0; i < texts.length; i++) {
    const memKey = keyOf(textKeys[i]);
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
        memSet(keyOf(key), hit);
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
            system: systemPrompt(lang, ctx),
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
              memSet(keyOf(missingKeys[idx]), hit);
              results[missingIdx[idx]] = hit;
              toStore.push({ textKey: missingKeys[idx], payload: hit });
            }
            // Anything the model skipped → cache EMPTY so we don't ask
            // again about the same near-empty inputs forever.
            for (let j = 0; j < missingText.length; j++) {
              if (!placed.has(j)) {
                memSet(keyOf(missingKeys[j]), EMPTY);
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
      const m = memGet(keyOf(textKeys[i]));
      if (m) results[i] = m;
    }
  }

  return NextResponse.json({ results });
}

// Catch + surface any uncaught throw as a JSON 500 instead of letting
// Next.js return an empty body that hides the cause.
export async function POST(req: Request) {
  try {
    return await _handlePost(req);
  } catch (err) {
    console.error("[explain] fatal", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
