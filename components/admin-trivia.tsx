"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Download, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { HeartFlag } from "@/components/flag";
import { AdminPageTitle } from "@/components/admin-page-title";
import { countries } from "@/lib/countries";

// Admin trivia surface. Lists every finalist country with its current
// question (file default unless overridden in DB) + answer stats from
// trivia_answers. Editing is JSON-only by design — the deck is small
// enough that paste+save is faster than a 60-field form, and the
// validation cycles in your text editor anyway.
//
// JSON shape (top-level array, no `deck` wrapper):
//
//   [{ country: { en, lt }, question: { en, lt },
//      options: [{en, lt} × 4], correct: 0..3 }, …]
//
// The ISO country code is resolved by matching `country.en` against
// the canonical EN name in lib/countries.ts.

export type TriviaRow = {
  country: string;
  name: string;
  hasCard: boolean;
  card: {
    correctIndex: number;
    en: { question: string; choices: string[] };
    lt: { question: string; choices: string[] };
  } | null;
  stats: { total: number; correct: number };
};

// External (JSON file) shape — the one the admin pastes + the export
// produces. Country is name-pair, options are option-pairs, correct
// is a plain index.
type ExportEntry = {
  country: { en: string; lt: string };
  question: { en: string; lt: string };
  options: { en: string; lt: string }[];
  correct: number;
};

// Server-bound shape — the one the API still consumes (flat per-
// language blocks + ISO code). We map ExportEntry → ServerEntry at
// save time so the server contract stays simple.
type ServerEntry = {
  country: string;
  correctIndex: number;
  en: { question: string; choices: string[] };
  lt: { question: string; choices: string[] };
};

// Country name → ISO code lookup. Built once. Names mirror the
// canonical EN spellings in lib/countries.ts (e.g. "Moldova", "United
// Kingdom"). Case-insensitive match.
const NAME_TO_CODE = new Map(
  countries.map((c) => [c.name.toLowerCase(), c.code]),
);

function rowsToExport(rows: TriviaRow[]): ExportEntry[] {
  return rows
    .filter((r) => r.card)
    .map((r) => {
      const c = countries.find((x) => x.code === r.country);
      const enName = c?.name ?? r.country.toUpperCase();
      // Reuse the EN name for LT when no override is set — the user
      // can edit the LT field manually after export.
      const ltName = enName;
      return {
        country: { en: enName, lt: ltName },
        question: { en: r.card!.en.question, lt: r.card!.lt.question },
        options: r.card!.en.choices.map((en, i) => ({
          en,
          lt: r.card!.lt.choices[i] ?? "",
        })),
        correct: r.card!.correctIndex,
      };
    });
}

// Convert the friendly JSON shape into the server's flat shape +
// resolve the ISO code via name lookup.
function toServerEntry(e: ExportEntry, where: string): ServerEntry | { error: string } {
  const enName = e.country.en.trim();
  const code = NAME_TO_CODE.get(enName.toLowerCase());
  if (!code) {
    return {
      error: `${where}: unknown country "${enName}". Names must match the EN spelling in lib/countries.ts (e.g. "Moldova", "United Kingdom").`,
    };
  }
  return {
    country: code,
    correctIndex: e.correct,
    en: {
      question: e.question.en,
      choices: e.options.map((o) => o.en),
    },
    lt: {
      question: e.question.lt,
      choices: e.options.map((o) => o.lt),
    },
  };
}

// Pretty pre-validation of a pasted JSON string. Returns either the
// parsed deck (in server shape, ready to POST) or a human-readable
// error string. Same shape checks the server runs, just earlier so
// the Save button can stay disabled.
function validateInput(raw: string): { deck: ServerEntry[] } | { error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return { error: `Not valid JSON: ${(e as Error).message}` };
  }
  if (!Array.isArray(parsed)) {
    return { error: "Expected a top-level array of question entries." };
  }
  const seen = new Set<string>();
  const out: ServerEntry[] = [];
  for (let i = 0; i < parsed.length; i++) {
    const entry = parsed[i] as Record<string, unknown> | null;
    const where = `entry #${i + 1}`;
    if (!entry || typeof entry !== "object") {
      return { error: `${where}: expected an object.` };
    }
    // country: { en, lt }
    const country = entry.country as Record<string, unknown> | null;
    if (!country || typeof country !== "object") {
      return { error: `${where}: \`country\` must be an { en, lt } object.` };
    }
    if (typeof country.en !== "string" || !country.en.trim()) {
      return { error: `${where}: \`country.en\` required.` };
    }
    if (typeof country.lt !== "string" || !country.lt.trim()) {
      return { error: `${where}: \`country.lt\` required.` };
    }
    // question: { en, lt }
    const question = entry.question as Record<string, unknown> | null;
    if (!question || typeof question !== "object") {
      return { error: `${where}: \`question\` must be an { en, lt } object.` };
    }
    if (typeof question.en !== "string" || !question.en.trim()) {
      return { error: `${where}: \`question.en\` required.` };
    }
    if (typeof question.lt !== "string" || !question.lt.trim()) {
      return { error: `${where}: \`question.lt\` required.` };
    }
    // options: [{en, lt} × 4]
    const options = entry.options;
    if (!Array.isArray(options) || options.length !== 4) {
      return { error: `${where}: \`options\` must be an array of exactly 4 { en, lt } pairs.` };
    }
    for (let j = 0; j < 4; j++) {
      const o = options[j] as Record<string, unknown> | null;
      if (!o || typeof o !== "object") {
        return { error: `${where}: \`options[${j}]\` must be an { en, lt } object.` };
      }
      if (typeof o.en !== "string" || !o.en.trim()) {
        return { error: `${where}: \`options[${j}].en\` required.` };
      }
      if (typeof o.lt !== "string" || !o.lt.trim()) {
        return { error: `${where}: \`options[${j}].lt\` required.` };
      }
    }
    // correct: 0..3
    const correct = entry.correct;
    if (
      typeof correct !== "number" ||
      !Number.isInteger(correct) ||
      correct < 0 ||
      correct > 3
    ) {
      return { error: `${where}: \`correct\` must be an integer 0..3.` };
    }
    const friendly: ExportEntry = {
      country: { en: country.en, lt: country.lt },
      question: { en: question.en, lt: question.lt },
      options: options.map((o) => ({
        en: (o as { en: string }).en,
        lt: (o as { lt: string }).lt,
      })),
      correct,
    };
    const server = toServerEntry(friendly, where);
    if ("error" in server) return server;
    if (seen.has(server.country)) {
      return { error: `${where}: duplicate country "${friendly.country.en}".` };
    }
    seen.add(server.country);
    out.push(server);
  }
  return { deck: out };
}

export function AdminTrivia({ initial }: { initial: TriviaRow[] }) {
  const [rows, setRows] = useState(initial);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  // Validation runs on every keystroke; it's cheap and the result
  // gates the Save button + drives the inline error message.
  const validation = useMemo(() => {
    if (!draft.trim()) return { kind: "empty" as const };
    const v = validateInput(draft);
    if ("error" in v) return { kind: "error" as const, message: v.error };
    return { kind: "ok" as const, count: v.deck.length, deck: v.deck };
  }, [draft]);

  const exportDeck = () => {
    const blob = new Blob(
      [JSON.stringify(rowsToExport(rows), null, 2)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trivia-deck-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openEditor = () => {
    if (!draft) {
      setDraft(JSON.stringify(rowsToExport(rows), null, 2));
    }
    setOpen(true);
  };

  const save = async () => {
    if (validation.kind !== "ok") return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/trivia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deck: validation.deck }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; count?: number };
      if (!res.ok) {
        toast.error(data.error ?? "Save failed.");
        return;
      }
      toast.success(`Saved ${data.count ?? validation.deck.length} questions.`);
      // Refresh the table by re-fetching the GET endpoint.
      const fresh = await fetch("/api/admin/trivia", { cache: "no-store" });
      if (fresh.ok) {
        const next = (await fresh.json()) as { deck: TriviaRow[] };
        setRows(next.deck);
      }
      setOpen(false);
    } catch {
      toast.error("Save failed (network).");
    } finally {
      setSaving(false);
    }
  };

  const filled = rows.filter((r) => r.hasCard).length;

  return (
    <div className="flex flex-col gap-6">
      {/* Page header lives here instead of the page wrapper so the
          Edit-questions button sits on the right of the gradient
          title; the per-deck status reads as the page subtitle.
          Single trailing button now — Export collapsed into the
          editor drawer alongside Save / Cancel, since both are
          deck-write workflows. */}
      <AdminPageTitle
        subtitle={`${filled}/${rows.length} countries have a question. Countries without one are skipped when they take the stage.`}
        trailing={
          <Button type="button" size="sm" onClick={openEditor}>
            <Pencil className="h-4 w-4 mr-1.5" /> Edit questions
          </Button>
        }
      >
        Trivia
      </AdminPageTitle>

      <section className="glass-card rounded-2xl p-5 sm:p-6 flex flex-col gap-5">
        <ol className="flex flex-col gap-2">
          {rows.map((r) => (
            <li
              key={r.country}
              className="flex items-start gap-3 rounded-xl bg-white/[0.03] ring-1 ring-white/8 p-3"
            >
              <HeartFlag code={r.country} size="sm" />
              <div className="flex-1 min-w-0 flex flex-col gap-2.5">
                <p className="font-display text-sm text-white/90">{r.name}</p>
                {r.card ? (
                  <>
                    <QuestionBlock
                      lang="EN"
                      question={r.card.en.question}
                      choices={r.card.en.choices}
                      correctIndex={r.card.correctIndex}
                    />
                    <QuestionBlock
                      lang="LT"
                      question={r.card.lt.question}
                      choices={r.card.lt.choices}
                      correctIndex={r.card.correctIndex}
                    />
                  </>
                ) : (
                  <p className="text-[13px] text-white/35 italic">
                    No question yet.
                  </p>
                )}
              </div>
              <div className="shrink-0 flex flex-col items-end gap-0.5 min-w-[5.5rem]">
                <span className="text-[11px] uppercase tracking-[0.15em] text-white/35 font-display">
                  Stats
                </span>
                <span className="font-display text-sm tabular-nums">
                  {r.stats.correct}
                  <span className="text-white/35">/{r.stats.total}</span>
                </span>
                <span className="text-[10px] text-white/35 tabular-nums">
                  {r.stats.total > 0
                    ? `${Math.round((r.stats.correct / r.stats.total) * 100)}% correct`
                    : "—"}
                </span>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Editor lives in a bottom-sheet drawer. Export sits inside
          the drawer's footer alongside Cancel / Save — both are
          deck-write workflows, so co-locating them is cleaner than
          scattering one button on the page header and one in a
          modal. The textarea uses the BottomSheet's own scroll
          area (no nested scroll) so a long deck JSON pages
          naturally inside the sheet. */}
      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Edit questions"
        sub="Paste a deck JSON. Save overwrites the live deck."
        footer={
          <>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={exportDeck}
              className="text-white/75"
            >
              <Download className="h-4 w-4 mr-1.5" /> Export current
            </Button>
            <div className="flex-1" />
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setOpen(false)}
              className="text-white/70"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={save}
              disabled={validation.kind !== "ok" || saving}
            >
              {saving ? "Saving…" : "Save deck"}
            </Button>
          </>
        }
      >
        <p className="text-xs text-white/55 leading-relaxed">
          Schema (top-level array, no <code className="text-white/70">deck</code> wrapper):
        </p>
        <pre className="font-mono text-[11px] leading-snug bg-black/30 ring-1 ring-white/8 rounded-lg p-3 text-white/70 overflow-x-auto">{`[
  {
    "country": { "en": "Moldova", "lt": "Moldova" },
    "question": { "en": "…", "lt": "…" },
    "options": [
      { "en": "A", "lt": "A" },
      { "en": "B", "lt": "B" },
      { "en": "C", "lt": "C" },
      { "en": "D", "lt": "D" }
    ],
    "correct": 0
  }
]`}</pre>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="font-mono text-xs leading-relaxed bg-black/40 ring-1 ring-white/12 rounded-xl p-3 min-h-[280px] text-white/85 focus:outline-none focus:ring-flamingo/40"
          spellCheck={false}
          placeholder='{ "deck": [...] }'
        />
        <div className="text-xs text-white/55">
          {validation.kind === "empty" && "Paste JSON to enable Save."}
          {validation.kind === "error" && (
            <span className="text-flamingo">{validation.message}</span>
          )}
          {validation.kind === "ok" && (
            <span className="text-turquoise">
              Valid. {validation.count} questions ready to write.
            </span>
          )}
        </div>
      </BottomSheet>
    </div>
  );
}

// One language's question + 4 choices, rendered as a tight stacked
// block. Both EN and LT instances share the same `correctIndex`
// (the deck enforces that the right answer lives at the same slot
// across languages), so the green check lands in the same row in
// both blocks.
function QuestionBlock({
  lang,
  question,
  choices,
  correctIndex,
}: {
  lang: "EN" | "LT";
  question: string;
  choices: string[];
  correctIndex: number;
}) {
  return (
    <div className="rounded-lg bg-white/[0.025] ring-1 ring-white/6 px-3 py-2">
      <div className="flex items-baseline gap-2">
        <span className="text-[10px] uppercase tracking-[0.18em] text-white/40 font-display tabular-nums">
          {lang}
        </span>
        <p className="text-[13px] text-white/85 leading-snug flex-1 min-w-0">
          {question}
        </p>
      </div>
      <ul className="text-[11px] text-white/55 mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
        {choices.map((c, i) => (
          <li
            key={i}
            className={
              i === correctIndex
                ? "text-turquoise inline-flex items-center gap-1"
                : ""
            }
          >
            {i === correctIndex && <Check className="h-3 w-3" />}
            {String.fromCharCode(65 + i)}. {c}
          </li>
        ))}
      </ul>
    </div>
  );
}
