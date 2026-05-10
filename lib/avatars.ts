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
};

export const AVATARS: Avatar[] = [
  { id: "abba-1974",            artist: "ABBA",                  country: "se", year: 1974, song: "Waterloo" },
  { id: "celine-1988",          artist: "Céline Dion",           country: "ch", year: 1988, song: "Ne partez pas sans moi" },
  { id: "dana-1998",            artist: "Dana International",    country: "il", year: 1998, song: "Diva" },
  { id: "ruslana-2004",         artist: "Ruslana",               country: "ua", year: 2004, song: "Wild Dances" },
  { id: "helena-2005",          artist: "Helena Paparizou",      country: "gr", year: 2005, song: "My Number One" },
  { id: "lordi-2006",           artist: "Lordi",                 country: "fi", year: 2006, song: "Hard Rock Hallelujah" },
  { id: "verka-2007",           artist: "Verka Serduchka",       country: "ua", year: 2007, song: "Dancing Lasha Tumbai" },
  { id: "dima-2008",            artist: "Dima Bilan",            country: "ru", year: 2008, song: "Believe" },
  { id: "alexander-2009",       artist: "Alexander Rybak",       country: "no", year: 2009, song: "Fairytale" },
  { id: "lena-2010",            artist: "Lena",                  country: "de", year: 2010, song: "Satellite" },
  { id: "azerbaijan-2011",      artist: "Ell & Nikki",           country: "az", year: 2011, song: "Running Scared" },
  { id: "loreen-2012",          artist: "Loreen",                country: "se", year: 2012, song: "Euphoria" },
  { id: "buranovskiye-2012",    artist: "Buranovskiye Babushki", country: "ru", year: 2012, song: "Party for Everybody" },
  { id: "emmelie-2013",         artist: "Emmelie de Forest",     country: "dk", year: 2013, song: "Only Teardrops" },
  { id: "conchita-2014",        artist: "Conchita Wurst",        country: "at", year: 2014, song: "Rise Like a Phoenix" },
  { id: "polina-2015",          artist: "Polina Gagarina",       country: "ru", year: 2015, song: "A Million Voices" },
  { id: "mans-2015",            artist: "Måns Zelmerlöw",        country: "se", year: 2015, song: "Heroes" },
  { id: "jamala-2016",          artist: "Jamala",                country: "ua", year: 2016, song: "1944" },
  { id: "salvador-2017",        artist: "Salvador Sobral",       country: "pt", year: 2017, song: "Amar pelos dois" },
  { id: "francesco-2017",       artist: "Francesco Gabbani",     country: "it", year: 2017, song: "Occidentali's Karma" },
  { id: "netta-2018",           artist: "Netta",                 country: "il", year: 2018, song: "Toy" },
  { id: "duncan-2019",          artist: "Duncan Laurence",       country: "nl", year: 2019, song: "Arcade" },
  { id: "mahmood-2019",         artist: "Mahmood",               country: "it", year: 2019, song: "Soldi" },
  { id: "daoi-2020",            artist: "Daði og Gagnamagnið",   country: "is", year: 2020, song: "Think About Things" },
  { id: "maneskin-2021",        artist: "Måneskin",              country: "it", year: 2021, song: "Zitti e buoni" },
  { id: "barbara-2021",         artist: "Barbara Pravi",         country: "fr", year: 2021, song: "Voilà" },
  { id: "kalush-2022",          artist: "Kalush Orchestra",      country: "ua", year: 2022, song: "Stefania" },
  { id: "subwoolfer-2022",      artist: "Subwoolfer",            country: "no", year: 2022, song: "Give That Wolf a Banana" },
  { id: "loreen-2023",          artist: "Loreen",                country: "se", year: 2023, song: "Tattoo" },
  { id: "kaarija-2023",         artist: "Käärijä",               country: "fi", year: 2023, song: "Cha Cha Cha" },
  { id: "alessandra-2023",      artist: "Alessandra Mele",       country: "no", year: 2023, song: "Queen of Kings" },
  { id: "mae-2023",             artist: "La Zarra",              country: "fr", year: 2023, song: "Évidemment" },
  { id: "nemo-2024",            artist: "Nemo",                  country: "ch", year: 2024, song: "The Code" },
  { id: "baby-lasagna-2024",    artist: "Baby Lasagna",          country: "hr", year: 2024, song: "Rim Tim Tagi Dim" },
  { id: "windows95man-2024",    artist: "Windows95man",          country: "fi", year: 2024, song: "No Rules!" },
  { id: "bambie-2024",          artist: "Bambie Thug",           country: "ie", year: 2024, song: "Doomsday Blue" },
  { id: "jj-2025",              artist: "JJ",                    country: "at", year: 2025, song: "Wasted Love" },
  { id: "tommy-2025",           artist: "Tommy Cash",            country: "ee", year: 2025, song: "Espresso Macchiato" },
  { id: "kaj-2025",              artist: "KAJ",                  country: "se", year: 2025, song: "Bara Bada Bastu" },
  { id: "katarsis-2025",        artist: "Katarsis",              country: "lt", year: 2025, song: "Tavo Akys" },
];

export function getAvatar(id: string | null | undefined): Avatar | null {
  if (!id) return null;
  return AVATARS.find((a) => a.id === id) ?? null;
}
