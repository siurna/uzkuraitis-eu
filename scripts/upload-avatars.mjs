/**
 * Mirror the past-act avatar photos from `avatars-src/` (the canonical,
 * version-controlled originals — kept out of `public/` so they don't
 * ride along in the deploy bundle) into the Vercel Blob store, and
 * record the public URLs in `lib/avatar-photos.json`. `lib/avatars.ts`
 * then serves those Blob URLs (routed through Next's image optimizer for
 * per-surface thumbnails — see `lib/img.ts`). There is no `public/`
 * fallback: an avatar shows a photo iff `avatars-src/<id>.<ext>` exists
 * and this script has been run.
 *
 * Run:  pnpm avatars:upload
 *   It reads BLOB_READ_WRITE_TOKEN — pull it down once with
 *   `vercel env pull .env.local` (the script auto-loads .env.local via
 *   `node --env-file-if-exists`), or pass it inline:
 *   `BLOB_READ_WRITE_TOKEN=… pnpm avatars:upload`. It's the same token
 *   the chat image-upload route uses (Vercel → Storage → Blob store →
 *   ".env.local" tab).
 *
 * Idempotent: re-running overwrites the same keys (stable, no random
 * suffix) and rewrites the JSON. Safe to run after adding new photos.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, extname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { put } from "@vercel/blob";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const SRC_DIR = join(ROOT, "avatars-src");
const OUT_JSON = join(ROOT, "lib", "avatar-photos.json");
const PREFIX = "avatars"; // key prefix inside the Blob store

const token = process.env.BLOB_READ_WRITE_TOKEN;
if (!token) {
  console.error(
    "BLOB_READ_WRITE_TOKEN is not set. Pull it from Vercel and re-run:\n" +
      "  vercel env pull .env.local && pnpm avatars:upload\n" +
      "or pass it inline:\n" +
      "  BLOB_READ_WRITE_TOKEN=… pnpm avatars:upload",
  );
  process.exit(1);
}

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

console.log(`Uploading ${files.length} avatar photos to Blob (prefix "${PREFIX}/")…`);

const map = {};
let n = 0;
for (const file of files) {
  const ext = extname(file).toLowerCase();
  const id = basename(file, ext);
  const data = readFileSync(join(SRC_DIR, file));
  const { url } = await put(`${PREFIX}/${file}`, data, {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: CONTENT_TYPES[ext],
    token,
  });
  map[id] = url;
  n += 1;
  console.log(`  ${String(n).padStart(2, " ")}/${files.length}  ${id}  →  ${url}`);
}

// Sort keys so diffs stay stable.
const sorted = Object.fromEntries(Object.keys(map).sort().map((k) => [k, map[k]]));
writeFileSync(OUT_JSON, JSON.stringify(sorted, null, 2) + "\n");
console.log(`\nWrote ${OUT_JSON} (${Object.keys(sorted).length} entries).`);
console.log("Commit it; lib/avatars.ts will now serve the Blob URLs.");
