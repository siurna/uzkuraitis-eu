// Route an image through Next's built-in optimizer (`/_next/image`),
// which resizes + re-encodes to webp/avif on first request and then
// CDN-caches it. Works for both `public/`-relative paths and remote
// URLs that are allow-listed in `next.config.mjs` → `images.remotePatterns`
// (the Vercel Blob host is). Use it wherever a big source image is shown
// at a small size — avatar grids, chat rows, list thumbnails — so the
// browser downloads a ~few-KB thumbnail instead of the full press kit.
//
// `width` should be one of Next's default `imageSizes` (16/32/48/64/96/
// 128/256/384) or `deviceSizes`; anything else gets rounded up.
export function optimizedSrc(
  src: string,
  width: number,
  quality = 72,
): string {
  if (!src || src.startsWith("/_next/image") || src.startsWith("data:")) {
    return src;
  }
  return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=${quality}`;
}
