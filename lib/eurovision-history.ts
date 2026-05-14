// Recent (last ~5 years) Eurovision entries per country. Conservatively
// curated — only well-known entries that I'm confident are correctly
// attributed. The beginner-mode explain route looks up `nowCountry`
// here and threads the result into the system prompt so the LLM can
// give specific "this country sent X last year" callbacks instead of
// vague "this country often sends memorable entries" filler.
//
// When a country isn't listed (or its recent entries aren't on hand),
// the prompt explicitly tells the model to acknowledge uncertainty
// rather than invent.

export type HistoricalEntry = {
  year: number;
  artist: string;
  song: string;
  /** Placement in the grand final, when known. Null when DQ / withdrew
   *  / didn't qualify out of the semi. */
  placement: number | null;
};

const HISTORY: Record<string, HistoricalEntry[]> = {
  // Big Five + host
  it: [
    { year: 2025, artist: "Lucio Corsi", song: "Volevo essere un duro", placement: 5 },
    { year: 2024, artist: "Angelina Mango", song: "La noia", placement: 7 },
    { year: 2023, artist: "Marco Mengoni", song: "Due vite", placement: 4 },
    { year: 2022, artist: "Mahmood & Blanco", song: "Brividi", placement: 6 },
    { year: 2021, artist: "Måneskin", song: "Zitti e buoni", placement: 1 },
  ],
  fr: [
    { year: 2025, artist: "Louane", song: "Maman", placement: 7 },
    { year: 2024, artist: "Slimane", song: "Mon amour", placement: 4 },
    { year: 2023, artist: "La Zarra", song: "Évidemment", placement: 16 },
    { year: 2022, artist: "Alvan & Ahez", song: "Fulenn", placement: 24 },
    { year: 2021, artist: "Barbara Pravi", song: "Voilà", placement: 2 },
  ],
  de: [
    { year: 2025, artist: "Abor & Tynna", song: "Baller", placement: 15 },
    { year: 2024, artist: "Isaak", song: "Always on the Run", placement: 12 },
    { year: 2023, artist: "Lord of the Lost", song: "Blood & Glitter", placement: 26 },
    { year: 2022, artist: "Malik Harris", song: "Rockstars", placement: 25 },
    { year: 2021, artist: "Jendrik", song: "I Don't Feel Hate", placement: 25 },
  ],
  es: [
    { year: 2025, artist: "Melody", song: "Esa diva", placement: 24 },
    { year: 2024, artist: "Nebulossa", song: "Zorra", placement: 22 },
    { year: 2023, artist: "Blanca Paloma", song: "Eaea", placement: 17 },
    { year: 2022, artist: "Chanel", song: "SloMo", placement: 3 },
    { year: 2021, artist: "Blas Cantó", song: "Voy a quedarme", placement: 24 },
  ],
  gb: [
    { year: 2025, artist: "Remember Monday", song: "What the Hell Just Happened?", placement: 19 },
    { year: 2024, artist: "Olly Alexander", song: "Dizzy", placement: 18 },
    { year: 2023, artist: "Mae Muller", song: "I Wrote a Song", placement: 25 },
    { year: 2022, artist: "Sam Ryder", song: "Space Man", placement: 2 },
    { year: 2021, artist: "James Newman", song: "Embers", placement: 26 },
  ],
  // Nordics + Baltics + perennial fan favourites
  se: [
    { year: 2025, artist: "KAJ", song: "Bara Bada Bastu", placement: 4 },
    { year: 2024, artist: "Marcus & Martinus", song: "Unforgettable", placement: 9 },
    { year: 2023, artist: "Loreen", song: "Tattoo", placement: 1 },
    { year: 2022, artist: "Cornelia Jakobs", song: "Hold Me Closer", placement: 4 },
    { year: 2012, artist: "Loreen", song: "Euphoria", placement: 1 },
  ],
  fi: [
    { year: 2025, artist: "Erika Vikman", song: "Ich komme", placement: 11 },
    { year: 2024, artist: "Windows95man", song: "No Rules!", placement: 19 },
    { year: 2023, artist: "Käärijä", song: "Cha Cha Cha", placement: 2 },
    { year: 2006, artist: "Lordi", song: "Hard Rock Hallelujah", placement: 1 },
  ],
  no: [
    { year: 2025, artist: "Kyle Alessandro", song: "Lighter", placement: 18 },
    { year: 2024, artist: "Gåte", song: "Ulveham", placement: 25 },
    { year: 2023, artist: "Alessandra", song: "Queen of Kings", placement: 5 },
    { year: 2009, artist: "Alexander Rybak", song: "Fairytale", placement: 1 },
  ],
  is: [
    { year: 2025, artist: "VÆB", song: "RÓA", placement: 25 },
    { year: 2024, artist: "Hera Björk", song: "Scared of Heights", placement: null },
    { year: 2020, artist: "Daði og Gagnamagnið", song: "Think About Things", placement: null },
  ],
  lt: [
    { year: 2025, artist: "Katarsis", song: "Tavo akys", placement: 16 },
    { year: 2024, artist: "Silvester Belt", song: "Luktelk", placement: 14 },
    { year: 2023, artist: "Monika Linkytė", song: "Stay", placement: 11 },
    { year: 2021, artist: "The Roop", song: "Discoteque", placement: 8 },
    { year: 2016, artist: "Donny Montell", song: "I've Been Waiting for This Night", placement: 9 },
    { year: 2006, artist: "LT United", song: "We Are the Winners", placement: 6 },
  ],
  ee: [
    { year: 2025, artist: "Tommy Cash", song: "Espresso Macchiato", placement: 3 },
    { year: 2024, artist: "5MIINUST x Puuluup", song: "(nendest) narkootikumidest ei tea me (küll) midagi", placement: 20 },
  ],
  lv: [
    { year: 2025, artist: "Tautumeitas", song: "Bur man laimi", placement: 13 },
  ],
  // Other long-form recognisable contributors
  ua: [
    { year: 2025, artist: "Ziferblat", song: "Bird of Pray", placement: 9 },
    { year: 2024, artist: "alyona alyona & Jerry Heil", song: "Teresa & Maria", placement: 3 },
    { year: 2022, artist: "Kalush Orchestra", song: "Stefania", placement: 1 },
    { year: 2016, artist: "Jamala", song: "1944", placement: 1 },
    { year: 2007, artist: "Verka Serduchka", song: "Dancing Lasha Tumbai", placement: 2 },
    { year: 2004, artist: "Ruslana", song: "Wild Dances", placement: 1 },
  ],
  ch: [
    { year: 2025, artist: "Zoë Më", song: "Voyage", placement: 10 },
    { year: 2024, artist: "Nemo", song: "The Code", placement: 1 },
    { year: 1988, artist: "Céline Dion", song: "Ne partez pas sans moi", placement: 1 },
  ],
  at: [
    { year: 2025, artist: "JJ", song: "Wasted Love", placement: 1 },
    { year: 2024, artist: "Kaleen", song: "We Will Rave", placement: 24 },
    { year: 2014, artist: "Conchita Wurst", song: "Rise Like a Phoenix", placement: 1 },
  ],
  nl: [
    { year: 2024, artist: "Joost Klein", song: "Europapa", placement: null },
    { year: 2019, artist: "Duncan Laurence", song: "Arcade", placement: 1 },
  ],
  il: [
    { year: 2025, artist: "Yuval Raphael", song: "New Day Will Rise", placement: 2 },
    { year: 2018, artist: "Netta", song: "Toy", placement: 1 },
    { year: 1998, artist: "Dana International", song: "Diva", placement: 1 },
  ],
  hr: [
    { year: 2025, artist: "Marko Bošnjak", song: "Poison Cake", placement: 13 },
    { year: 2024, artist: "Baby Lasagna", song: "Rim Tim Tagi Dim", placement: 2 },
  ],
  pt: [
    { year: 2017, artist: "Salvador Sobral", song: "Amar pelos dois", placement: 1 },
  ],
  ie: [
    { year: 2024, artist: "Bambie Thug", song: "Doomsday Blue", placement: 6 },
  ],
  gr: [
    { year: 2025, artist: "Klavdia", song: "Asteromata", placement: 6 },
    { year: 2024, artist: "Marina Satti", song: "Zari", placement: 11 },
    { year: 2005, artist: "Helena Paparizou", song: "My Number One", placement: 1 },
  ],
  cy: [
    { year: 2025, artist: "Theo Evan", song: "Shh", placement: 15 },
  ],
  rs: [
    { year: 2024, artist: "Teya Dora", song: "Ramonda", placement: 17 },
  ],
  am: [
    { year: 2024, artist: "Ladaniva", song: "Jako", placement: 8 },
  ],
  ge: [
    { year: 2025, artist: "Mariam Shengelia", song: "Freedom", placement: null },
  ],
  pl: [
    { year: 2025, artist: "Justyna Steczkowska", song: "Gaja", placement: 19 },
  ],
};

export function getRecentEntries(code: string): HistoricalEntry[] {
  return HISTORY[code] ?? [];
}
