// 40 iconic Eurovision acts that fans can pick as their avatar.
// Each entry uses the artist's country (ISO 3166-1 alpha-2 lowercase) for
// the visible flag + a year subscript. Slugs are stable identifiers used
// in Liveblocks presence and persisted to localStorage.
//
// Curated for cultural recognisability rather than chart wins; mostly
// post-2000, with a handful of older legends. Adjust freely.

export type Avatar = {
  /** Stable identifier persisted to localStorage and Liveblocks presence. */
  id: string;
  artist: string;
  country: string; // iso alpha-2 lowercase
  year: number;
  song: string;
  /** Optional press-kit photo URL. Falls back to country flag if unset. */
  photo?: string;
  /**
   * Where the face sits in the photo, as percentages of the natural
   * image size (0,0 = top-left, 50,50 = centre). Used as
   * `object-position` so the square crop lands on the face. Defaults to
   * `{ x: 50, y: 30 }` (top-centre) when unset.
   */
  focal?: { x: number; y: number };
};

export const AVATARS: Avatar[] = [
  { id: "abba-1974",            artist: "ABBA",                  country: "se", year: 1974, song: "Waterloo", photo: "/avatars/abba-1974.jpg", focal: { x: 40, y: 25 } },
  { id: "celine-1988",          artist: "Céline Dion",           country: "ch", year: 1988, song: "Ne partez pas sans moi", photo: "/avatars/celine-1988.jpg", focal: { x: 47, y: 30 } },
  { id: "dana-1998",            artist: "Dana International",    country: "il", year: 1998, song: "Diva", photo: "/avatars/dana-1998.jpg", focal: { x: 50, y: 45 } },
  { id: "ruslana-2004",         artist: "Ruslana",               country: "ua", year: 2004, song: "Wild Dances", photo: "/avatars/ruslana-2004.jpg", focal: { x: 48, y: 25 } },
  { id: "helena-2005",          artist: "Helena Paparizou",      country: "gr", year: 2005, song: "My Number One", photo: "/avatars/helena-2005.jpg", focal: { x: 45, y: 35 } },
  { id: "lordi-2006",           artist: "Lordi",                 country: "fi", year: 2006, song: "Hard Rock Hallelujah", photo: "/avatars/lordi-2006.jpg", focal: { x: 45, y: 30 } },
  { id: "lt-united-2006",       artist: "LT United",             country: "lt", year: 2006, song: "We Are the Winners", photo: "/avatars/lt-united-2006.jpg", focal: { x: 52, y: 35 } },
  { id: "verka-2007",           artist: "Verka Serduchka",       country: "ua", year: 2007, song: "Dancing Lasha Tumbai", photo: "/avatars/verka-2007.jpg", focal: { x: 48, y: 30 } },
  { id: "alexander-2009",       artist: "Alexander Rybak",       country: "no", year: 2009, song: "Fairytale", photo: "/avatars/alexander-2009.jpg", focal: { x: 40, y: 25 } },
  { id: "lena-2010",            artist: "Lena",                  country: "de", year: 2010, song: "Satellite", photo: "/avatars/lena-2010.png", focal: { x: 50, y: 35 } },
  { id: "azerbaijan-2011",      artist: "Ell & Nikki",           country: "az", year: 2011, song: "Running Scared", photo: "/avatars/azerbaijan-2011.jpg", focal: { x: 65, y: 22 } },
  { id: "loreen-2012",          artist: "Loreen",                country: "se", year: 2012, song: "Euphoria", photo: "/avatars/loreen-2012.jpg", focal: { x: 47, y: 25 } },
  { id: "emmelie-2013",         artist: "Emmelie de Forest",     country: "dk", year: 2013, song: "Only Teardrops", photo: "/avatars/emmelie-2013.jpg", focal: { x: 42, y: 22 } },
  { id: "conchita-2014",        artist: "Conchita Wurst",        country: "at", year: 2014, song: "Rise Like a Phoenix", photo: "/avatars/conchita-2014.jpg", focal: { x: 50, y: 35 } },
  { id: "mans-2015",            artist: "Måns Zelmerlöw",        country: "se", year: 2015, song: "Heroes", photo: "/avatars/mans-2015.jpg", focal: { x: 47, y: 30 } },
  { id: "jamala-2016",          artist: "Jamala",                country: "ua", year: 2016, song: "1944", photo: "/avatars/jamala-2016.jpg", focal: { x: 42, y: 22 } },
  { id: "donny-2016",           artist: "Donny Montell",         country: "lt", year: 2016, song: "I've Been Waiting for This Night", photo: "/avatars/donny-2016.jpg", focal: { x: 42, y: 25 } },
  { id: "salvador-2017",        artist: "Salvador Sobral",       country: "pt", year: 2017, song: "Amar pelos dois", photo: "/avatars/salvador-2017.jpg", focal: { x: 55, y: 30 } },
  { id: "francesco-2017",       artist: "Francesco Gabbani",     country: "it", year: 2017, song: "Occidentali's Karma", photo: "/avatars/francesco-2017.jpg", focal: { x: 48, y: 30 } },
  { id: "netta-2018",           artist: "Netta",                 country: "il", year: 2018, song: "Toy", photo: "/avatars/netta-2018.jpg", focal: { x: 38, y: 22 } },
  { id: "duncan-2019",          artist: "Duncan Laurence",       country: "nl", year: 2019, song: "Arcade", photo: "/avatars/duncan-2019.png", focal: { x: 48, y: 25 } },
  { id: "mahmood-2019",         artist: "Mahmood",               country: "it", year: 2019, song: "Soldi", photo: "/avatars/mahmood-2019.png", focal: { x: 50, y: 35 } },
  { id: "daoi-2020",            artist: "Daði og Gagnamagnið",   country: "is", year: 2020, song: "Think About Things", photo: "/avatars/daoi-2020.jpg", focal: { x: 55, y: 28 } },
  { id: "maneskin-2021",        artist: "Måneskin",              country: "it", year: 2021, song: "Zitti e buoni", photo: "/avatars/maneskin-2021.jpg", focal: { x: 50, y: 25 } },
  { id: "barbara-2021",         artist: "Barbara Pravi",         country: "fr", year: 2021, song: "Voilà", photo: "/avatars/barbara-2021.jpg", focal: { x: 53, y: 25 } },
  { id: "the-roop-2021",        artist: "The Roop",              country: "lt", year: 2021, song: "Discoteque", photo: "/avatars/the-roop-2021.jpg", focal: { x: 55, y: 30 } },
  { id: "kalush-2022",          artist: "Kalush Orchestra",      country: "ua", year: 2022, song: "Stefania", photo: "/avatars/kalush-2022.jpg", focal: { x: 50, y: 30 } },
  { id: "subwoolfer-2022",      artist: "Subwoolfer",            country: "no", year: 2022, song: "Give That Wolf a Banana", photo: "/avatars/subwoolfer-2022.jpg", focal: { x: 50, y: 30 } },
  { id: "loreen-2023",          artist: "Loreen",                country: "se", year: 2023, song: "Tattoo", photo: "/avatars/loreen-2023.jpg", focal: { x: 48, y: 38 } },
  { id: "kaarija-2023",         artist: "Käärijä",               country: "fi", year: 2023, song: "Cha Cha Cha", photo: "/avatars/kaarija-2023.jpg", focal: { x: 53, y: 25 } },
  { id: "alessandra-2023",      artist: "Alessandra Mele",       country: "no", year: 2023, song: "Queen of Kings", photo: "/avatars/alessandra-2023.jpg", focal: { x: 47, y: 18 } },
  { id: "mae-2023",             artist: "La Zarra",              country: "fr", year: 2023, song: "Évidemment", photo: "/avatars/mae-2023.jpg", focal: { x: 45, y: 22 } },
  { id: "monika-2023",          artist: "Monika Linkytė",        country: "lt", year: 2023, song: "Stay", photo: "/avatars/monika-2023.jpg", focal: { x: 55, y: 25 } },
  { id: "nemo-2024",            artist: "Nemo",                  country: "ch", year: 2024, song: "The Code", photo: "/avatars/nemo-2024.jpg", focal: { x: 47, y: 35 } },
  { id: "baby-lasagna-2024",    artist: "Baby Lasagna",          country: "hr", year: 2024, song: "Rim Tim Tagi Dim", photo: "/avatars/baby-lasagna-2024.jpg", focal: { x: 45, y: 25 } },
  { id: "windows95man-2024",    artist: "Windows95man",          country: "fi", year: 2024, song: "No Rules!", photo: "/avatars/windows95man-2024.jpg", focal: { x: 50, y: 35 } },
  { id: "bambie-2024",          artist: "Bambie Thug",           country: "ie", year: 2024, song: "Doomsday Blue", photo: "/avatars/bambie-2024.jpg", focal: { x: 42, y: 25 } },
  { id: "silvester-2024",       artist: "Silvester Belt",        country: "lt", year: 2024, song: "Luktelk", photo: "/avatars/silvester-2024.jpg", focal: { x: 42, y: 15 } },
  { id: "jj-2025",              artist: "JJ",                    country: "at", year: 2025, song: "Wasted Love", photo: "/avatars/jj-2025.jpg", focal: { x: 55, y: 35 } },
  { id: "tommy-2025",           artist: "Tommy Cash",            country: "ee", year: 2025, song: "Espresso Macchiato", photo: "/avatars/tommy-2025.jpg", focal: { x: 55, y: 30 } },
  { id: "kaj-2025",              artist: "KAJ",                  country: "se", year: 2025, song: "Bara Bada Bastu", photo: "/avatars/kaj-2025.jpg", focal: { x: 50, y: 28 } },
  { id: "katarsis-2025",        artist: "Katarsis",              country: "lt", year: 2025, song: "Tavo Akys", photo: "/avatars/katarsis-2025.jpg", focal: { x: 50, y: 30 } },
];

// Synthesised entries for every artist in this year's grand final.
// Photos live at /public/participants/<code>.<ext> (scraped from
// eurovision.com). Sourced from lib/countries.ts so the artist + song
// stay in lockstep with the standings/voting data.
import { countries } from "./countries";
import { participantPhoto } from "./participants";

const YEAR_2026_AVATARS: Avatar[] = countries
  .filter((c) => c.artist && c.artist !== "TBD")
  .map((c) => ({
    id: `${c.code}-2026`,
    artist: c.artist,
    country: c.code,
    year: 2026,
    song: c.song,
    photo: participantPhoto(c.code) ?? undefined,
    focal: { x: 50, y: 30 },
  }));

// Prepend so this year's artists land at the top of the picker grid
// — the contest in front of you matters more than every iconic past
// act combined. Mutates AVATARS once at module load.
AVATARS.unshift(...YEAR_2026_AVATARS);

export function getAvatar(id: string | null | undefined): Avatar | null {
  if (!id) return null;
  return AVATARS.find((a) => a.id === id) ?? null;
}
