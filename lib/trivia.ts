// One trivia card per finalist country. Real Eurovision-themed deck
// goes here once curated; the entries below are general-knowledge demo
// questions wired to the first 30 countries by running order so the
// trivia mechanic surfaces during dev sessions.
//
// Trivia mechanics — kept intentionally small:
//   - ONE question per country, max.
//   - Fires at a deterministic offset (30s … 3m30s) after that country
//     hits the stage, computed from `triviaOffsetMs(roomCode, country)`
//     so every client in the room shows it at the same wall-clock
//     moment without needing server-side scheduling.
//   - +2 to the final tally for a correct answer, 0 otherwise. The
//     server records the answer + correctness in `trivia_answers`; the
//     leaderboard adds it to each row's total.
//   - Skipped entirely once the host has revealed results.

export type TriviaPick = 0 | 1 | 2 | 3;

export type TriviaLanguageBlock = {
  question: string;
  choices: readonly [string, string, string, string];
};

export type TriviaCard = {
  /** ISO 3166-1 alpha-2 lowercase. */
  country: string;
  /** 0..3, same across languages. */
  correctIndex: TriviaPick;
  en: TriviaLanguageBlock;
  lt: TriviaLanguageBlock;
};

export const TRIVIA_DECK: readonly TriviaCard[] = [
  {
    country: "al",
    correctIndex: 1,
    en: { question: "What color is the sky on a clear day?", choices: ["Green", "Blue", "Red", "Yellow"] },
    lt: { question: "Kokios spalvos giedras dangus?", choices: ["Žalias", "Mėlynas", "Raudonas", "Geltonas"] },
  },
  {
    country: "am",
    correctIndex: 2,
    en: { question: "What is 2 + 2?", choices: ["3", "22", "4", "5"] },
    lt: { question: "Kiek yra 2 + 2?", choices: ["3", "22", "4", "5"] },
  },
  {
    country: "au",
    correctIndex: 2,
    en: { question: "What sound does a cat make?", choices: ["Woof", "Moo", "Meow", "Quack"] },
    lt: { question: "Kokį garsą skleidžia katė?", choices: ["Au au", "Mū", "Miau", "Kva kva"] },
  },
  {
    country: "at",
    correctIndex: 3,
    en: { question: "In which direction does the sun rise?", choices: ["North", "South", "West", "East"] },
    lt: { question: "Iš kurios pusės teka saulė?", choices: ["Šiaurės", "Pietų", "Vakarų", "Rytų"] },
  },
  {
    country: "az",
    correctIndex: 2,
    en: { question: "How many days are in a week?", choices: ["5", "6", "7", "8"] },
    lt: { question: "Kiek dienų yra savaitėje?", choices: ["5", "6", "7", "8"] },
  },
  {
    country: "be",
    correctIndex: 3,
    en: { question: "What is the capital of France?", choices: ["London", "Berlin", "Madrid", "Paris"] },
    lt: { question: "Kokia yra Prancūzijos sostinė?", choices: ["Londonas", "Berlynas", "Madridas", "Paryžius"] },
  },
  {
    country: "bg",
    correctIndex: 1,
    en: { question: "What is the largest ocean on Earth?", choices: ["Atlantic", "Pacific", "Indian", "Arctic"] },
    lt: { question: "Koks yra didžiausias Žemės vandenynas?", choices: ["Atlanto", "Ramusis", "Indijos", "Arkties"] },
  },
  {
    country: "hr",
    correctIndex: 2,
    en: { question: "What do fish breathe with?", choices: ["Lungs", "Skin", "Gills", "Nostrils"] },
    lt: { question: "Kuo kvėpuoja žuvys?", choices: ["Plaučiais", "Oda", "Žiaunomis", "Šnervėmis"] },
  },
  {
    country: "cy",
    correctIndex: 1,
    en: { question: "How many wheels does a standard bicycle have?", choices: ["1", "2", "3", "4"] },
    lt: { question: "Kiek ratų turi įprastas dviratis?", choices: ["1", "2", "3", "4"] },
  },
  {
    country: "cz",
    correctIndex: 2,
    en: { question: "What color is fresh grass?", choices: ["Blue", "Yellow", "Green", "Brown"] },
    lt: { question: "Kokios spalvos šviežia žolė?", choices: ["Mėlyna", "Geltona", "Žalia", "Ruda"] },
  },
  {
    country: "dk",
    correctIndex: 1,
    en: { question: "Which is the tallest animal on land?", choices: ["Elephant", "Giraffe", "Horse", "Camel"] },
    lt: { question: "Koks yra aukščiausias sausumos gyvūnas?", choices: ["Dramblys", "Žirafa", "Arklys", "Kupranugaris"] },
  },
  {
    country: "ee",
    correctIndex: 1,
    en: { question: "What is frozen water called?", choices: ["Steam", "Ice", "Snow", "Rain"] },
    lt: { question: "Kaip vadinamas užšalęs vanduo?", choices: ["Garas", "Ledas", "Sniegas", "Lietus"] },
  },
  {
    country: "fi",
    correctIndex: 3,
    en: { question: "What is the currency of the United States?", choices: ["Euro", "Pound", "Yen", "Dollar"] },
    lt: { question: "Kokia yra Jungtinių Amerikos Valstijų valiuta?", choices: ["Euras", "Svaras", "Jena", "Doleris"] },
  },
  {
    country: "fr",
    correctIndex: 1,
    en: { question: "How many eyes does a human have?", choices: ["1", "2", "3", "4"] },
    lt: { question: "Kiek akių turi žmogus?", choices: ["1", "2", "3", "4"] },
  },
  {
    country: "ge",
    correctIndex: 2,
    en: { question: "How many months are in a year?", choices: ["10", "11", "12", "13"] },
    lt: { question: "Kiek mėnesių yra metuose?", choices: ["10", "11", "12", "13"] },
  },
  {
    country: "de",
    correctIndex: 1,
    en: { question: "What color is a ripe banana?", choices: ["Red", "Yellow", "Purple", "Blue"] },
    lt: { question: "Kokios spalvos prinokęs bananas?", choices: ["Raudonas", "Geltonas", "Violetinis", "Mėlynas"] },
  },
  {
    country: "gr",
    correctIndex: 1,
    en: { question: "What do bees produce?", choices: ["Milk", "Honey", "Butter", "Sugar"] },
    lt: { question: "Ką gamina bitės?", choices: ["Pieną", "Medų", "Sviestą", "Cukrų"] },
  },
  {
    country: "il",
    correctIndex: 2,
    en: { question: "What is the capital of the United Kingdom?", choices: ["Paris", "Dublin", "London", "Edinburgh"] },
    lt: { question: "Kokia yra Jungtinės Karalystės sostinė?", choices: ["Paryžius", "Dublinas", "Londonas", "Edinburgas"] },
  },
  {
    country: "it",
    correctIndex: 1,
    en: { question: "The Sun is a what?", choices: ["Planet", "Star", "Moon", "Comet"] },
    lt: { question: "Kas yra Saulė?", choices: ["Planeta", "Žvaigždė", "Mėnulis", "Kometa"] },
  },
  {
    country: "lv",
    correctIndex: 2,
    en: { question: "What does H₂O refer to?", choices: ["Salt", "Oxygen", "Water", "Hydrogen"] },
    lt: { question: "Ką žymi H₂O?", choices: ["Druska", "Deguonis", "Vanduo", "Vandenilis"] },
  },
  {
    country: "lt",
    correctIndex: 3,
    en: { question: "Which is the largest planet in our solar system?", choices: ["Earth", "Mars", "Saturn", "Jupiter"] },
    lt: { question: "Kuri yra didžiausia mūsų Saulės sistemos planeta?", choices: ["Žemė", "Marsas", "Saturnas", "Jupiteris"] },
  },
  {
    country: "lu",
    correctIndex: 1,
    en: { question: "What shape is the Earth?", choices: ["Flat", "Sphere (roughly round)", "Cube", "Pyramid"] },
    lt: { question: "Kokios formos Žemė?", choices: ["Plokščia", "Apvali (rutulys)", "Kubas", "Piramidė"] },
  },
  {
    country: "mt",
    correctIndex: 0,
    en: { question: "At what temperature does water freeze (in Celsius)?", choices: ["0°C", "10°C", "100°C", "-10°C"] },
    lt: { question: "Kokioje temperatūroje (pagal Celsijų) užšąla vanduo?", choices: ["0°C", "10°C", "100°C", "-10°C"] },
  },
  {
    country: "md",
    correctIndex: 2,
    en: { question: "In \"Tom and Jerry\", what kind of animal is Jerry?", choices: ["Cat", "Dog", "Mouse", "Rabbit"] },
    lt: { question: "Animacijoje „Tomas ir Džeris“ koks gyvūnas yra Džeris?", choices: ["Katė", "Šuo", "Pelė", "Triušis"] },
  },
  {
    country: "me",
    correctIndex: 0,
    en: { question: "What number comes after 9?", choices: ["10", "11", "0", "19"] },
    lt: { question: "Koks skaičius eina po 9?", choices: ["10", "11", "0", "19"] },
  },
  {
    country: "no",
    correctIndex: 3,
    en: { question: "Which country is pizza originally from?", choices: ["France", "Greece", "Spain", "Italy"] },
    lt: { question: "Iš kurios šalies kilo pica?", choices: ["Prancūzija", "Graikija", "Ispanija", "Italija"] },
  },
  {
    country: "pl",
    correctIndex: 2,
    en: { question: "How many wheels does a standard car have?", choices: ["2", "3", "4", "6"] },
    lt: { question: "Kiek ratų turi įprastas automobilis?", choices: ["2", "3", "4", "6"] },
  },
  {
    country: "pt",
    correctIndex: 1,
    en: { question: "Which is the largest continent?", choices: ["Africa", "Asia", "Europe", "Australia"] },
    lt: { question: "Kuris yra didžiausias žemynas?", choices: ["Afrika", "Azija", "Europa", "Australija"] },
  },
  {
    country: "ro",
    correctIndex: 3,
    en: { question: "Which is the smallest planet in our solar system?", choices: ["Earth", "Venus", "Mars", "Mercury"] },
    lt: { question: "Kuri yra mažiausia mūsų Saulės sistemos planeta?", choices: ["Žemė", "Venera", "Marsas", "Merkurijus"] },
  },
  {
    country: "sm",
    correctIndex: 2,
    en: { question: "What color is snow?", choices: ["Black", "Grey", "White", "Blue"] },
    lt: { question: "Kokios spalvos sniegas?", choices: ["Juodas", "Pilkas", "Baltas", "Mėlynas"] },
  },
];

export const TRIVIA_BY_COUNTRY: Record<string, TriviaCard> = Object.fromEntries(
  TRIVIA_DECK.map((c) => [c.country, c]),
);

export function getTrivia(countryCode: string): TriviaCard | null {
  return TRIVIA_BY_COUNTRY[countryCode.toLowerCase()] ?? null;
}

// Range: 30s..3m30s after the country takes the stage.
const TRIVIA_MIN_MS = 30_000;
const TRIVIA_MAX_MS = 3 * 60_000 + 30_000;

// Deterministic offset (in milliseconds) so every client in the same
// room sees the question at the same wall-clock moment relative to the
// country going on stage. Cheap djb2 hash; we just need uniform spread.
export function triviaOffsetMs(roomCode: string, countryCode: string): number {
  const s = `${roomCode}|${countryCode}`;
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  const normalised = (h >>> 0) / 0xffffffff;
  return Math.round(TRIVIA_MIN_MS + normalised * (TRIVIA_MAX_MS - TRIVIA_MIN_MS));
}

/** Points awarded for a correct trivia answer. */
export const TRIVIA_POINTS = 2;
