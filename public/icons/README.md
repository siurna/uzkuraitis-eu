# PWA icons

Drop your exported PNGs here. Filenames are referenced by
`app/manifest.ts` and the Next metadata-file convention; if you rename
anything, update both.

## Files to save

From your 1024 × 1024 master, export the following sizes and save with
the exact filenames below. All PNGs, fully opaque, no transparency
(iOS does not mask transparent backgrounds for PWA icons).

| File | Size | Purpose |
|---|---|---|
| `../../app/icon.png` | 512 × 512 | Favicon source. Next auto-generates smaller variants. |
| `../../app/apple-icon.png` | 180 × 180 | iOS Add-to-Home-Screen tile. Next auto-binds the `apple-touch-icon` link tag. |
| `icon-192.png` | 192 × 192 | Android / Chrome PWA install. |
| `icon-512.png` | 512 × 512 | Android PWA install + splash. |
| `icon-maskable.png` | 512 × 512 | Android adaptive icon. Keep all critical content inside the centre 80% (10% padding on every side) — launchers crop the outer ring on some devices. |

## Design constraints

- Opaque background (no alpha). Pick a fill that pops on both light
  and dark home screens — the room dark-blue (`#10142a`) works.
- For `icon-maskable.png`: pretend the outer 10% will be sliced off.
  Centre your logo and pad inwards.
- Keep the logo recognisable at 32 × 32 — Android favicons end up that
  small in some browser contexts.

## Splash screens (optional, iOS only)

If you want a non-default iOS launch splash, add files named
`splash-{width}x{height}.png` here and update
`app/layout.tsx`'s `<link rel="apple-touch-startup-image">` tags. The
list of sizes Apple expects is long; a generator like
[realfavicongenerator.net](https://realfavicongenerator.net) or
`pwa-asset-generator` produces them in one shot.
