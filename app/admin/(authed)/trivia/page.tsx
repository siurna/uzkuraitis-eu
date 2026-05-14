import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { triviaAnswers } from "@/lib/db/schema";
import { loadMergedDeck } from "@/lib/trivia-store";
import { countries } from "@/lib/countries";
import { AdminTrivia, type TriviaRow } from "@/components/admin-trivia";

export default async function AdminTriviaPage() {
  // Same shape the GET endpoint returns — we render the initial state
  // server-side and the client component takes over for save/reload.
  const [deck, statsRows] = await Promise.all([
    loadMergedDeck(),
    db
      .select({
        countryCode: triviaAnswers.countryCode,
        total: sql<number>`COUNT(*)::int`,
        correct: sql<number>`COUNT(*) FILTER (WHERE ${triviaAnswers.correct})::int`,
      })
      .from(triviaAnswers)
      .groupBy(triviaAnswers.countryCode),
  ]);
  const statsByCountry = Object.fromEntries(
    statsRows.map((r) => [r.countryCode, { total: r.total, correct: r.correct }]),
  );
  const initial: TriviaRow[] = countries.map((c) => {
    const card = deck.get(c.code);
    return {
      country: c.code,
      name: c.name,
      hasCard: !!card,
      card: card
        ? {
            correctIndex: card.correctIndex,
            en: { question: card.en.question, choices: [...card.en.choices] },
            lt: { question: card.lt.question, choices: [...card.lt.choices] },
          }
        : null,
      stats: statsByCountry[c.code] ?? { total: 0, correct: 0 },
    };
  });

  // AdminTrivia owns its own page header now (title + subtitle +
  // Export/Import buttons sit in one row at the top), so the page
  // wrapper stays a single fragment.
  return <AdminTrivia initial={initial} />;
}

export const dynamic = "force-dynamic";
