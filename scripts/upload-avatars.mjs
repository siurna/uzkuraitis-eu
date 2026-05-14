/**
 * Mirror the past-act avatar photos from `avatars-src/` (the canonical,
 * version-controlled originals — kept out of `public/` so they don't
 * ride along in the deploy bundle) into the Supabase Storage `avatars`
 * bucket, and record the public URLs in `lib/avatar-photos.json`.
 * `lib/avatars.ts` then serves those Supabase URLs (routed through
 * Next's image optimizer for per-surface thumbnails — see `lib/img.ts`).
 *
 * Run:  pnpm avatars:upload
 *   It reads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 *   Pull them once via `vercel env pull .env.local`; the package.json
 *   script auto-loads `.env.local` via `node --env-file-if-exists`.
 *
 * Idempotent: `upsert: true` overwrites the same keys (stable, no
 * random suffix). Safe to run after adding new photos.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, extname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const SRC_DIR = join(ROOT, "avatars-src");
const OUT_JSON = join(ROOT, "lib", "avatar-photos.json");
const BUCKET = "avatars";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error(
    "Need NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.\n" +
      "Pull them via: vercel env pull .env.local && pnpm avatars:upload",
  );
  process.exit(1);
}

const supabase = createClient(URL, KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const CONTENT_TYPES = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

const files = readdirSync(SRC_DIR)
  .filter((f) => extname(f).toLowerCase() in CONTENT_TYPES)
  .sort();

if (files.length === 0) {
  console.error(`No images found in ${SRC_DIR}`);
  process.exit(1);
}

console.log(
  `Uploading ${files.length} avatar photos to Supabase Storage bucket "${BUCKET}"…`,
);

const map = {};
let n = 0;
for (const file of files) {
  const ext = extname(file).toLowerCase();
  const id = basename(file, ext);
  const data = readFileSync(join(SRC_DIR, file));
  const { error } = await supabase.storage.from(BUCKET).upload(file, data, {
    contentType: CONTENT_TYPES[ext],
    upsert: true,
    cacheControl: "public, max-age=31536000, immutable",
  });
  if (error) {
    console.error(`  ✗ ${id}  →  ${error.message}`);
    process.exit(1);
  }
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(file);
  map[id] = pub.publicUrl;
  n += 1;
  console.log(
    `  ${String(n).padStart(2, " ")}/${files.length}  ${id}  →  ${pub.publicUrl}`,
  );
}

// Sort keys so diffs stay stable.
const sorted = Object.fromEntries(
  Object.keys(map)
    .sort()
    .map((k) => [k, map[k]]),
);
writeFileSync(OUT_JSON, JSON.stringify(sorted, null, 2) + "\n");
console.log(`\nWrote ${OUT_JSON} (${Object.keys(sorted).length} entries).`);
console.log("Commit it; lib/avatars.ts will now serve the Supabase URLs.");
