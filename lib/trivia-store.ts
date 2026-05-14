import { db } from "@/lib/db";
import { triviaQuestions } from "@/lib/db/schema";
import {
  TRIVIA_BY_COUNTRY,
  type TriviaCard,
  type TriviaPick,
} from "@/lib/trivia";

// Per-Lambda cache of the merged deck. The deck changes only when an
// admin pastes a fresh JSON over it; in normal use it's read on every
// trivia post + every validation. Cache for 60s so a fresh deploy or
// a save propagates within a reasonable window without us having to
// invalidate explicitly. The `bumpDeckCache()` export below lets the
// admin write path short-circuit the wait when it knows the deck
// changed.

let cache: { deck: Map<string, TriviaCard>; loadedAt: number } | null = null;
const CACHE_TTL_MS = 60_000;

function fromDbRow(row: typeof triviaQuestions.$inferSelect): TriviaCard {
  const en = row.enChoices;
  const lt = row.ltChoices;
  return {
    country: row.countryCode,
    correctIndex: row.correctIndex as TriviaPick,
    en: {
      question: row.enQuestion,
      // Postgres text[] reads as string[]; we narrow to the readonly
      // 4-tuple the type expects after a length check at the writer.
      choices: [en[0] ?? "", en[1] ?? "", en[2] ?? "", en[3] ?? ""] as const,
    },
    lt: {
      question: row.ltQuestion,
      choices: [lt[0] ?? "", lt[1] ?? "", lt[2] ?? "", lt[3] ?? ""] as const,
    },
  };
}

export async function loadMergedDeck(): Promise<Map<string, TriviaCard>> {
  if (cache && Date.now() - cache.loadedAt < CACHE_TTL_MS) {
    return cache.deck;
  }
  const overrides = await db.select().from(triviaQuestions);
  const merged = new Map<string, TriviaCard>();
  // File default first, DB overrides on top.
  for (const [code, card] of Object.entries(TRIVIA_BY_COUNTRY)) {
    merged.set(code, card);
  }
  for (const row of overrides) {
    merged.set(row.countryCode, fromDbRow(row));
  }
  cache = { deck: merged, loadedAt: Date.now() };
  return merged;
}

export async function getTriviaMerged(
  countryCode: string,
): Promise<TriviaCard | null> {
  const deck = await loadMergedDeck();
  return deck.get(countryCode.toLowerCase()) ?? null;
}

// Called by the admin write path so the next read sees fresh data
// without waiting out the TTL.
export function bumpDeckCache(): void {
  cache = null;
}
