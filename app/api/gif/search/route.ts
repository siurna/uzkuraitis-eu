import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { gifCache } from "@/lib/db/schema";

// Klipy proxy + cache.
//
// Klipy's API: https://api.klipy.com/api/v1/{API_KEY}/gifs/search?q=…
// returns { data: [{ id, slug, title, file: { gif:{url}, mp4:{url}, … } }] }.
//
// We normalise it into a thin shape the client can render directly,
// store in gif_cache for 24h keyed by lowercased query, and serve from
// cache thereafter. Hot terms like "yes", "fire", "omg" hit the DB
// instead of Klipy after the first call.

const TTL_HOURS = 24;

type GifResult = {
  id: string;
  title: string;
  url: string;
  preview: string;
  width: number;
  height: number;
};

// Klipy nests each item as:
//   { id, slug, title, file: { hd|md|sm: { gif|webp|mp4: { url, width, height, size } } } }
// We pick md for the chat bubble (HD is 3-4MB, too heavy) and sm for
// the picker grid preview. Falls back to whatever's available.
function normaliseKlipy(payload: unknown): GifResult[] {
  type Variant = { url?: string; width?: number; height?: number };
  type Bucket = { gif?: Variant; webp?: Variant; mp4?: Variant; webm?: Variant };
  type KlipyItem = {
    id?: number | string;
    slug?: string;
    title?: string;
    file?: { hd?: Bucket; md?: Bucket; sm?: Bucket };
  };
  const items =
    (payload as { data?: { data?: KlipyItem[] } })?.data?.data ??
    (payload as { data?: KlipyItem[] })?.data ??
    [];
  if (!Array.isArray(items)) return [];

  const variantUrl = (b: Bucket | undefined): Variant | null =>
    b?.gif?.url
      ? b.gif
      : b?.webp?.url
        ? b.webp
        : b?.mp4?.url
          ? b.mp4
          : null;

  return items
    .map((it): GifResult | null => {
      const f = it.file;
      const main =
        variantUrl(f?.md) ?? variantUrl(f?.hd) ?? variantUrl(f?.sm);
      if (!main?.url) return null;
      const previewVariant = variantUrl(f?.sm) ?? main;
      return {
        id: String(it.id ?? it.slug ?? main.url),
        title: it.title ?? "",
        url: main.url,
        preview: previewVariant.url ?? main.url,
        width: main.width ?? 0,
        height: main.height ?? 0,
      };
    })
    .filter((x): x is GifResult => x !== null);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const qRaw = url.searchParams.get("q") ?? "";
  const q = qRaw.trim().toLowerCase().slice(0, 80);
  if (!q) {
    return NextResponse.json({ results: [] });
  }

  // Cache lookup.
  const cached = await db
    .select()
    .from(gifCache)
    .where(eq(gifCache.q, q))
    .limit(1);
  if (cached[0]) {
    const age =
      (Date.now() - cached[0].fetchedAt.getTime()) / (1000 * 60 * 60);
    if (age < TTL_HOURS) {
      return NextResponse.json(
        { results: cached[0].results as GifResult[], cached: true },
        { headers: { "Cache-Control": "public, max-age=300" } },
      );
    }
  }

  const apiKey = process.env.KLIPY_API_KEY;
  if (!apiKey) {
    // Degrade gracefully — chat just hides the GIF tab if no key.
    return NextResponse.json({ results: [], error: "Klipy not configured" }, { status: 503 });
  }

  let results: GifResult[] = [];
  try {
    const upstream = await fetch(
      `https://api.klipy.com/api/v1/${apiKey}/gifs/search?q=${encodeURIComponent(q)}&per_page=24`,
      { headers: { accept: "application/json" } },
    );
    if (upstream.ok) {
      const json = await upstream.json();
      results = normaliseKlipy(json);
    }
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[gif] klipy fetch failed", err);
    }
  }

  // Best-effort cache upsert (even on empty — failed search results
  // are cheap and a failed upstream means we likely won't do better
  // for 24h).
  await db
    .insert(gifCache)
    .values({ q, results })
    .onConflictDoUpdate({
      target: gifCache.q,
      set: { results, fetchedAt: sql`now()` },
    });

  return NextResponse.json({ results });
}
