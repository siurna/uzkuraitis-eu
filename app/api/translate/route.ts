import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
// The SDK's structured-output helper expects a Zod v4 schema; we get it
// from `zod/v4` (a parallel export the package ships alongside the v3
// API we use for everything else).
import * as zv4 from "zod/v4";
import { readSignedSessionId } from "@/lib/server-session";
import { checkAndIncrement } from "@/lib/rate-limit";

// POST /api/translate
//
// Body: { text }
// Returns: { translate: boolean, text: string }
//
// Powers the "auto-translate to English" toggle. We send each candidate
// chat message to Anthropic's nano-class model (Haiku 4.5 by default)
// and let it decide whether the English-speaking viewer would benefit
// from a rendering. Pure English passes through; Lithuanian (or
// Lithuanian-flavoured slang/cultural references) gets a concise
// translation with bracketed notes where helpful.
//
// Requires ANTHROPIC_API_KEY in the environment. Without it, the
// endpoint soft-fails to `{ translate: false }` so the feature degrades
// cleanly. Override the model via ANTHROPIC_TRANSLATE_MODEL — Haiku 4.5
// is the right call for cost/latency, but Sonnet 4.6 will catch more
// idioms if you can afford it.
//
// In-memory per-warm-instance cache so identical text doesn't hit the
// model twice — chat has heavy repetition (one-word reactions etc.).
// The cache is best-effort: serverless instances are ephemeral.

const Body = z.object({ text: z.string().min(1).max(2000) });

// Anthropic's structured-output runner validates against this schema
// server-side — we pull `parsed_output` straight off the response.
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
type CachedHit = zv4.infer<typeof TranslationResult>;

const cache = new Map<string, CachedHit>();
const MAX_CACHE = 1000;

function cacheGet(key: string): CachedHit | null {
  return cache.get(key) ?? null;
}
function cacheSet(key: string, hit: CachedHit): void {
  cache.set(key, hit);
  if (cache.size > MAX_CACHE) {
    // Crude FIFO eviction — Map preserves insertion order.
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
}

const SYSTEM_PROMPT = [
  "You help an English-speaking viewer follow a Lithuanian Eurovision watch-party chat.",
  "You are given ONE chat message. Decide whether an English speaker would benefit from a translation or cultural unpack.",
  "Rules:",
  '- If the message is already clear, idiomatic English without Lithuanian content, set translate=false and text="".',
  "- If it contains Lithuanian text, or Lithuanian-specific slang/cultural references that an English speaker wouldn't catch, set translate=true and text to a concise English rendering.",
  "- For cultural references, you may add a short [bracketed note] after the rendering. Keep the whole `text` under 200 characters.",
  "- Don't translate single emoji, single English words, or already-English phrases. Don't editorialise.",
].join("\n");

// Lazy client — initialised on first request so the absence of the env
// var doesn't crash the route at import time.
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
  const text = parsed.data.text;

  const cached = cacheGet(text);
  if (cached) return NextResponse.json(cached);

  // Identify the caller. Falls back to a coarse IP bucket so anonymous
  // hits can't bypass the limit. Cache hits above don't count against
  // the budget — only fresh model calls do.
  const session = await readSignedSessionId();
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const bucket = `translate:${session ?? `ip:${ip}`}`;
  const limited = await checkAndIncrement(bucket, 60, 60_000);
  if (limited) {
    return NextResponse.json({ translate: false, text: "" }, { status: 429 });
  }

  const client = getClient();
  if (!client) {
    // Soft fail — the toggle stays on; messages just don't get a rendering.
    return NextResponse.json({ translate: false, text: "" });
  }

  try {
    const response = await client.messages.parse({
      model: process.env.ANTHROPIC_TRANSLATE_MODEL ?? "claude-haiku-4-5",
      max_tokens: 256,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: text }],
      output_config: { format: zodOutputFormat(TranslationResult) },
    });
    const parsed = TranslationResult.safeParse(response.parsed_output);
    const hit: CachedHit = parsed.success
      ? parsed.data
      : { translate: false, text: "" };
    // Belt-and-braces: drop stray text if the model went translate=false but still produced
    // a string, and hard-cap the rendering even if the model exceeded the soft limit.
    if (!hit.translate) hit.text = "";
    if (hit.text.length > 240) hit.text = hit.text.slice(0, 240);
    cacheSet(text, hit);
    return NextResponse.json(hit);
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      console.warn("[translate] anthropic", err.status, err.message);
    } else {
      console.warn("[translate] unexpected", err);
    }
    return NextResponse.json({ translate: false, text: "" });
  }
}

export const dynamic = "force-dynamic";
