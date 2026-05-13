// One trivia card per finalist country. The user will hand-curate the
// real deck in a separate chat session; everything below is just two
// example entries so the dev build works.
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
    country: "lt",
    correctIndex: 0,
    en: {
      question: "When did Lithuania first compete at Eurovision?",
      choices: ["1994", "1991", "2001", "2008"],
    },
    lt: {
      question: "Kuriais metais Lietuva pirmą kartą dalyvavo Eurovizijoje?",
      choices: ["1994", "1991", "2001", "2008"],
    },
  },
  {
    country: "se",
    correctIndex: 1,
    en: {
      question: "How many times has Sweden won Eurovision?",
      choices: ["5", "7", "9", "10"],
    },
    lt: {
      question: "Kiek kartų Švedija laimėjo Euroviziją?",
      choices: ["5", "7", "9", "10"],
    },
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
