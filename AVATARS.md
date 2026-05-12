# Avatars

How the "pick a Eurovision act as your avatar" photos are stored and served.

## What there is

Two pools of avatar photos, both defined in [`lib/avatars.ts`](./lib/avatars.ts):

| Pool | Entries | `id` shape | Source image |
|---|---|---|---|
| Iconic past acts | ~40, hand-curated | `<slug>-<year>` (e.g. `loreen-2012`, `kaarija-2023`) | `public/avatars/<id>.{jpg,png}` |
| This year's grand-final lineup | one per competing country, auto-derived from `lib/countries.ts` | `<code>-2026` (e.g. `se-2026`) | `public/participants/<code>.{jpg,png}` (via `participantPhoto()`) |

Every entry also carries a `focal` point — `{ x, y }` as percentages of the
natural image — which becomes the `object-position` of the square crop so the
face lands in frame. Default when unset: `{ x: 50, y: 30 }` (top-centre).

If an entry has no usable photo, the UI falls back to the country flag
(`<HeartFlag/>` / `<Flag/>`).

## Serving — thumbnails for free

Source photos are press-kit JPEGs, ~150–400 KB each. They are **never sent at
full size to a small surface.** Every avatar `<img>` runs its `src` through
`optimizedSrc()` ([`lib/img.ts`](./lib/img.ts)), which rewrites it to a
`/_next/image?url=…&w=…&q=72` URL — Next's built-in image optimizer resizes +
re-encodes to webp/avif on first request and the CDN caches the result. One
source image, every size derived on demand:

| Surface | Element size | `optimizedSrc(photo, w)` |
|---|---|---|
| Avatar picker grid | ~83 px tile | `128` |
| Chat row avatar | 36 px | `96` |
| Settings avatar tile | 48 px | `128` |
| Now-playing / country deep-dive hero | full-bleed | `1080` |

That's why there are no pre-baked `*-thumb.webp` files to keep in sync — there's
nothing stopping us from adding them later if the optimizer's transformation
quota ever becomes a concern, but for ~40 images it never will.

## Where the bytes live — `public/` vs Blob

`public/avatars/*` is the canonical, reviewable source (committed to the repo).
It's also ~16 MB, which bloats the deploy bundle, so the photos are **mirrored
to the Vercel Blob store** and `lib/avatars.ts` prefers the Blob URL when one is
recorded:

1. [`scripts/upload-avatars.mjs`](./scripts/upload-avatars.mjs) uploads each
   `public/avatars/<id>.<ext>` to the Blob store under `avatars/<id>.<ext>`
   (stable key, no random suffix) and writes the resulting public URLs to
   [`lib/avatar-photos.json`](./lib/avatar-photos.json).
2. `lib/avatars.ts` imports that JSON and, for every avatar whose `id` appears
   there, swaps the inline `/avatars/…` path for the Blob URL. The inline path
   remains as a local-dev fallback (so the picker still works before you've run
   the upload, or in a checkout without Blob access).
3. `images.remotePatterns` in `next.config.mjs` allow-lists
   `*.public.blob.vercel-storage.com` so the optimizer can fetch from Blob.

### Running the upload

```bash
vercel env pull .env.local   # once — grabs BLOB_READ_WRITE_TOKEN (and the rest)
pnpm avatars:upload          # auto-loads .env.local via node --env-file-if-exists
```

(or pass the token inline: `BLOB_READ_WRITE_TOKEN=vercel_blob_rw_… pnpm avatars:upload`.)

Then commit the updated `lib/avatar-photos.json`. It's idempotent — re-run it
after adding new photos; existing keys are overwritten in place.

Once everything's mirrored and the JSON is committed, you can optionally
`git rm public/avatars/*` to shed the 16 MB from the deploy bundle — the app
will run entirely off the Blob URLs (you just lose the offline dev fallback).

> The 2026 participant photos in `public/participants/` are **not** mirrored yet.
> Same pattern would apply (`participantPhoto()` already centralises the lookup);
> extend `scripts/upload-avatars.mjs` with a second pass + a
> `lib/participant-photos.json` if/when that 16 MB matters too. Note the OG
> share-card route (`app/api/og/[code]/[voterId]/route.tsx`) renders via satori
> and fetches the photo URL directly, so it benefits from a Blob URL but cannot
> use `/_next/image`.

## Adding a new past-act avatar

1. Drop a square-ish portrait at `public/avatars/<slug>-<year>.jpg` (or `.png`).
   Tighter-than-the-final-crop is fine; the `focal` point handles framing.
2. Add an entry to `AVATARS` in `lib/avatars.ts` — `id` must match the filename
   stem. Eyeball `focal` (percentages from the top-left; bump `y` down if the
   face is low, nudge `x` toward the face for group shots).
3. `pnpm avatars:upload` → commit `lib/avatar-photos.json`.
