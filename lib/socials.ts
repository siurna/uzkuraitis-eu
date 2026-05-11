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

// Partial coverage — only artists whose official accounts could be
// cross-verified. Spotify "artist" IDs marked below are best-effort;
// give them a quick click before launch. The rest of the lineup is
// left out on purpose rather than guessed at.
export const COUNTRY_SOCIALS: Record<string, ArtistSocials> = {
  au: {
    instagram: "https://www.instagram.com/deltagoodrem/",
    spotify: "https://open.spotify.com/artist/2g6fa86fL6oLcoDqanBbuR",
    youtube: "https://www.youtube.com/channel/UCoY0y0Phy8UzDteuNVZw2wg",
  },
  at: {
    instagram: "https://www.instagram.com/cosmomachtmusik/",
    tiktok: "https://www.tiktok.com/@cosmomachtmusik",
    website: "https://benjamingedeon.com",
  },
  bg: {
    website: "https://www.thisisdara.com/",
  },
  cy: {
    instagram: "https://www.instagram.com/antigoni/",
    spotify: "https://open.spotify.com/artist/1w3S0hfHSbOupc4EVLRGrW", // best-effort
  },
  ee: {
    instagram: "https://www.instagram.com/thisisvanillaninja/",
    spotify: "https://open.spotify.com/artist/7ukHWEkVkYBIbJAZG51OvL",
  },
  fi: {
    instagram: "https://www.instagram.com/lindalampeniusofficial/",
    spotify: "https://open.spotify.com/artist/177ZOBPSU9yqO6IdomgK3T",
  },
  de: {
    instagram: "https://www.instagram.com/sarellax3/",
    spotify: "https://open.spotify.com/artist/7iK3kLye8FTBgYuqhg7v5P",
  },
  it: {
    instagram: "https://www.instagram.com/saldavinciofficial/",
    spotify: "https://open.spotify.com/artist/7cdIY4mDfM1dbjgl7s2fGR", // best-effort
    youtube: "https://www.youtube.com/@saldavinciofficial",
    tiktok: "https://www.tiktok.com/@saldavinci",
  },
  mt: {
    instagram: "https://www.instagram.com/itsaidanofficial/",
    youtube: "https://www.youtube.com/@Itsaidanofficial",
    website: "https://aidanofficial.com",
  },
  sm: {
    instagram: "https://www.instagram.com/senhitofficial/",
    spotify: "https://open.spotify.com/artist/0kgOnYSaZeTf3ZnErgwkGT",
    youtube: "https://www.youtube.com/user/senhitofficial",
    website: "https://www.senhit.com/",
  },
  ch: {
    instagram: "https://www.instagram.com/veronicafusaro/",
    spotify: "https://open.spotify.com/artist/2Nu9BiGXLIAbTs0mrbsmRW",
  },
};

export function artistSocials(code: string): ArtistSocials | null {
  const s = COUNTRY_SOCIALS[code.toLowerCase()];
  if (!s) return null;
  const has = Object.values(s).some(Boolean);
  return has ? s : null;
}
