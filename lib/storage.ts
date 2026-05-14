import { createClient } from "@supabase/supabase-js";

// Server-only Supabase Storage helpers. We use the service-role key
// here so uploads bypass RLS — the buckets are public-read but only
// writable from the server. Never import this from client code.

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

// Lazy singleton so each Lambda warm-keeps one client. Service-role
// clients don't keep an open websocket — they're HTTP only — so this
// is cheap.
let cached: ReturnType<typeof createClient> | null = null;

function client() {
  if (cached) return cached;
  if (!URL || !SERVICE) {
    throw new Error(
      "Supabase Storage env missing. Need NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  cached = createClient(URL, SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

export type Bucket = "avatars" | "commentator" | "chat";

export async function uploadImage(
  bucket: Bucket,
  path: string,
  body: ArrayBuffer | Uint8Array | Blob,
  contentType: string,
): Promise<{ url: string; path: string }> {
  const c = client();
  const { error } = await c.storage.from(bucket).upload(path, body, {
    contentType,
    upsert: false,
    cacheControl: "public, max-age=31536000, immutable",
  });
  if (error) throw error;
  const { data } = c.storage.from(bucket).getPublicUrl(path);
  return { url: data.publicUrl, path };
}

// Delete every object in a bucket whose key starts with `prefix`.
// We batch list + remove in pages of 1000 (Supabase's list cap) so the
// per-room delete on a chat-heavy room doesn't time out.
export async function deletePrefix(
  bucket: Bucket,
  prefix: string,
): Promise<{ deleted: number }> {
  const c = client();
  let total = 0;
  while (true) {
    const { data: entries, error } = await c.storage
      .from(bucket)
      .list(prefix, { limit: 1000 });
    if (error) throw error;
    if (!entries || entries.length === 0) break;
    const paths = entries.map((e) => `${prefix}${e.name}`);
    const { error: rmErr } = await c.storage.from(bucket).remove(paths);
    if (rmErr) throw rmErr;
    total += paths.length;
    if (entries.length < 1000) break;
  }
  return { deleted: total };
}
