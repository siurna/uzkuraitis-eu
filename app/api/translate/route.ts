import { NextResponse } from "next/server";
import { z } from "zod";

// POST /api/translate
//
// Body: { text }
// Returns: { translate: boolean, text: string }
//
// Powers the "auto-translate to English" toggle. We send each candidate
// chat message to a nano-sized model and let it decide whether the
// English-speaking viewer would benefit from a rendering — pure English
// passes through, Lithuanian (or Lithuanian-flavoured slang/cultural
// references) gets a concise translation with bracketed notes where
// helpful.
//
// Requires OPENAI_API_KEY in the environment. Without it, the endpoint
// soft-fails to `{ translate: false }` so the feature degrades cleanly.
//
// In-memory per-warm-instance cache so identical text doesn't hit the
// model twice — typical chat has heavy repetition (one-word reactions
// etc.). The cache is best-effort: serverless instances are ephemeral.

const Body = z.object({ text: z.string().min(1).max(2000) });

type CachedHit = { translate: boolean; text: string };
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
  "- If the message is already clear, idiomatic English without Lithuanian content, respond {\"translate\": false, \"text\": \"\"}.",
  "- If it contains Lithuanian text, or Lithuanian-specific slang/cultural references that an English speaker wouldn't catch, respond {\"translate\": true, \"text\": \"<a concise English rendering>\"}.",
  "- For cultural references, you may add a short [bracketed note] after the rendering. Keep the whole `text` under 200 characters.",
  "- Don't translate single emoji, single English words, or already-English phrases. Don't editorialise.",
  "Respond with valid JSON only. No code fences, no commentary.",
].join("\n");

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const text = parsed.data.text;

  const cached = cacheGet(text);
  if (cached) return NextResponse.json(cached);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    // Soft fail — the toggle stays on; messages just don't get a rendering.
    return NextResponse.json({ translate: false, text: "" });
  }

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_TRANSLATE_MODEL ?? "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: text },
        ],
        response_format: { type: "json_object" },
        temperature: 0,
        max_tokens: 200,
      }),
    });
    if (!res.ok) {
      return NextResponse.json({ translate: false, text: "" });
    }
    const payload = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = payload.choices?.[0]?.message?.content ?? "{}";
    let parsedHit: CachedHit;
    try {
      const obj = JSON.parse(raw) as Partial<CachedHit>;
      parsedHit = {
        translate: !!obj.translate,
        text: typeof obj.text === "string" ? obj.text.slice(0, 240) : "",
      };
      if (!parsedHit.translate) parsedHit.text = "";
    } catch {
      parsedHit = { translate: false, text: "" };
    }
    cacheSet(text, parsedHit);
    return NextResponse.json(parsedHit);
  } catch {
    return NextResponse.json({ translate: false, text: "" });
  }
}

export const dynamic = "force-dynamic";
