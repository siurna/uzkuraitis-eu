import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { triviaAnswers, triviaQuestions } from "@/lib/db/schema";
import { isAdminAuthed } from "@/lib/admin/session";
import { loadMergedDeck, bumpDeckCache } from "@/lib/trivia-store";
import { countries } from "@/lib/countries";

// GET = merged deck (file defaults + DB overrides) plus per-country
// answer stats. POST = replace the trivia_questions table wholesale
// from a pasted JSON payload. Admin-only either way.

const ChoicesTuple = z
  .array(z.string().min(1).max(120))
  .length(4, "Each language block must have exactly 4 choices.");

const QuestionBlock = z.object({
  question: z.string().min(1).max(280),
  choices: ChoicesTuple,
});

const DeckEntry = z.object({
  country: z
    .string()
    .length(2, "country must be a 2-letter ISO code")
    .toLowerCase(),
  correctIndex: z.number().int().min(0).max(3),
  en: QuestionBlock,
  lt: QuestionBlock,
});

const Body = z.object({ deck: z.array(DeckEntry).max(60) });

export async function GET() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fan out: merged deck + per-country answer stats.
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

  // Return one entry per finalist country so the UI can render every
  // slot — including the ones the admin hasn't authored yet.
  const list = countries.map((c) => {
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

  return NextResponse.json({ deck: list });
}

export async function POST(req: Request) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid body" },
      { status: 400 },
    );
  }

  const validCodes = new Set(countries.map((c) => c.code));
  for (const entry of parsed.data.deck) {
    if (!validCodes.has(entry.country)) {
      return NextResponse.json(
        { error: `Unknown country: ${entry.country}` },
        { status: 400 },
      );
    }
  }

  // Wholesale replace: wipe then insert. Brief empty window is
  // acceptable for an admin save (no in-flight reads expect a
  // particular row to exist; getTriviaMerged falls back to the file
  // default if a row is missing).
  await db.delete(triviaQuestions);
  if (parsed.data.deck.length > 0) {
    await db.insert(triviaQuestions).values(
      parsed.data.deck.map((d) => ({
        countryCode: d.country,
        correctIndex: d.correctIndex,
        enQuestion: d.en.question,
        enChoices: d.en.choices,
        ltQuestion: d.lt.question,
        ltChoices: d.lt.choices,
      })),
    );
  }
  bumpDeckCache();
  return NextResponse.json({ ok: true, count: parsed.data.deck.length });
}

export const dynamic = "force-dynamic";
