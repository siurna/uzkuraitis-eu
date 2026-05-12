// Press-kit hero photos for the 2026 grand-final lineup. Scraped once
// from eurovision.com/.../vienna-2026/all-participants/ and stored
// under /public/participants/<code>.<ext>.
//
// Most are JPGs; a handful arrived as PNGs (transparency on the artist
// silhouette). We hardcode the exceptions instead of doing a runtime
// HEAD probe — the lineup doesn't change once the contest is locked.

const PNG_CODES = new Set(["ge", "hr", "md"]);

export function participantPhoto(code: string): string | null {
  const c = code?.toLowerCase();
  if (!c) return null;
  const ext = PNG_CODES.has(c) ? "png" : "jpg";
  return `/participants/${c}.${ext}`;
}
