// Per-artist social links, keyed on ISO 3166-1 alpha-2 lowercase
// country code. Optional fields — surfaced in the country deep-dive
// sheet when present. Populated during the pre-launch verification
// pass (same as artist/song in lib/countries.ts); leave a country out
// rather than guess a handle.
export type ArtistSocials = {
  instagram?: string;
  spotify?: string;
  youtube?: string;
  tiktok?: string;
  website?: string;
};

export const COUNTRY_SOCIALS: Record<string, ArtistSocials> = {
  // e.g. se: { instagram: "https://instagram.com/…", spotify: "https://open.spotify.com/artist/…" },
};

export function artistSocials(code: string): ArtistSocials | null {
  const s = COUNTRY_SOCIALS[code.toLowerCase()];
  if (!s) return null;
  const has = Object.values(s).some(Boolean);
  return has ? s : null;
}
