/**
 * One-shot: move existing Vercel Blob URLs over to Supabase Storage.
 *
 *   1. chat_messages.gif_url where it points at *.blob.vercel-storage.com
 *      → chat bucket, under `<room_id>/<filename>` (matches the live
 *      upload route's prefix scheme so the room-delete cleanup finds
 *      everything in one prefix-list).
 *   2. commentator.text for the "__photo__" key (the live-commentator
 *      avatar) → commentator bucket.
 *   3. lib/avatar-photos.json (pre-rendered Eurovision-act portraits)
 *      → avatars bucket. JSON is rewritten with the new URLs so the
 *      next deploy serves them.
 *
 * Klipy / GIF service URLs (chat_messages with kind="gif") are NOT
 * touched — we never owned those.
 *
 * Run locally (the sandbox has no outbound TCP to Supabase pooler):
 *
 *   vercel env pull .env.local
 *   node --env-file-if-exists=.env.local scripts/migrate-blobs-to-buckets.mjs
 *
 * Needs: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * DATABASE_URL (any of the unpooled / pooled Postgres URLs work).
 * Idempotent — each row's gif_url switches over once it's rewritten,
 * so re-running re-skips already-migrated rows.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, extname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const AVATARS_JSON = join(ROOT, "lib", "avatar-photos.json");

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DB = process.env.DATABASE_URL;
if (!URL || !KEY || !DB) {
  console.error(
    "Missing env: need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL.",
  );
  process.exit(1);
}

const supabase = createClient(URL, KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const sql = postgres(DB, { prepare: false, max: 4, idle_timeout: 20 });

// Pretty-print a Vercel Blob URL pattern check.
function isVercelBlob(u) {
  return typeof u === "string" && /\.blob\.vercel-storage\.com\//.test(u);
}

function inferContentType(filename) {
  const ext = extname(filename).toLowerCase();
  return (
    {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".webp": "image/webp",
      ".gif": "image/gif",
    }[ext] ?? "application/octet-stream"
  );
}

async function copyUrlToBucket(srcUrl, bucket, destPath) {
  const res = await fetch(srcUrl);
  if (!res.ok) {
    throw new Error(`fetch ${srcUrl} → ${res.status}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const contentType =
    res.headers.get("content-type") ?? inferContentType(destPath);
  const { error } = await supabase.storage.from(bucket).upload(destPath, buf, {
    contentType,
    upsert: true,
    cacheControl: "public, max-age=31536000, immutable",
  });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(destPath);
  return data.publicUrl;
}

async function migrateChatMessages() {
  const rows = await sql`
    SELECT id, room_id, gif_url
    FROM chat_messages
    WHERE kind = 'image'
      AND gif_url IS NOT NULL
      AND gif_url ~ 'blob\\.vercel-storage\\.com'
  `;
  console.log(`chat_messages: ${rows.length} rows to migrate.`);
  let ok = 0;
  let failed = 0;
  for (const row of rows) {
    const filename = basename(new globalThis.URL(row.gif_url).pathname);
    const destPath = `${row.room_id}/${filename}`;
    try {
      const newUrl = await copyUrlToBucket(row.gif_url, "chat", destPath);
      await sql`UPDATE chat_messages SET gif_url = ${newUrl} WHERE id = ${row.id}`;
      ok += 1;
      console.log(`  ✓ ${row.id}  →  ${newUrl}`);
    } catch (err) {
      failed += 1;
      console.error(`  ✗ ${row.id}  ${err.message}`);
    }
  }
  console.log(`chat_messages: ${ok} migrated, ${failed} failed.\n`);
}

async function migrateCommentatorPhoto() {
  const rows = await sql`
    SELECT country_code, text
    FROM commentator
    WHERE country_code = '__photo__'
      AND text ~ 'blob\\.vercel-storage\\.com'
  `;
  if (rows.length === 0) {
    console.log("commentator photo: nothing to migrate.\n");
    return;
  }
  for (const row of rows) {
    const filename = basename(new globalThis.URL(row.text).pathname);
    try {
      const newUrl = await copyUrlToBucket(row.text, "commentator", filename);
      await sql`UPDATE commentator SET text = ${newUrl} WHERE country_code = '__photo__'`;
      console.log(`commentator photo  →  ${newUrl}\n`);
    } catch (err) {
      console.error(`commentator photo: ${err.message}\n`);
    }
  }
}

async function migrateAvatarPhotos() {
  let map;
  try {
    map = JSON.parse(readFileSync(AVATARS_JSON, "utf8"));
  } catch {
    console.log("avatar-photos.json missing; skipping avatars.");
    return;
  }
  const todo = Object.entries(map).filter(([, url]) => isVercelBlob(url));
  if (todo.length === 0) {
    console.log("avatar photos: nothing to migrate.\n");
    return;
  }
  console.log(`avatar photos: ${todo.length} URLs to migrate.`);
  for (const [id, url] of todo) {
    const filename = basename(new globalThis.URL(url).pathname);
    try {
      const newUrl = await copyUrlToBucket(url, "avatars", filename);
      map[id] = newUrl;
      console.log(`  ✓ ${id}  →  ${newUrl}`);
    } catch (err) {
      console.error(`  ✗ ${id}  ${err.message}`);
    }
  }
  const sorted = Object.fromEntries(
    Object.keys(map)
      .sort()
      .map((k) => [k, map[k]]),
  );
  writeFileSync(AVATARS_JSON, JSON.stringify(sorted, null, 2) + "\n");
  console.log("Wrote lib/avatar-photos.json. Commit it.\n");
}

async function main() {
  await migrateChatMessages();
  await migrateCommentatorPhoto();
  await migrateAvatarPhotos();
  await sql.end({ timeout: 5 });
  console.log("done.");
}

main().catch(async (err) => {
  console.error(err);
  await sql.end({ timeout: 5 });
  process.exit(1);
});
