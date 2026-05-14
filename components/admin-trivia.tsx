"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Lightbulb, Check, Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeartFlag } from "@/components/flag";

// Admin trivia surface. Lists every finalist country with its current
// question (file default unless overridden in DB) + answer stats from
// trivia_answers. Editing is JSON-only by design — the deck is small
// enough that paste+save is faster than a 60-field form, and the
// validation cycles in your text editor anyway.

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

type ExportEntry = {
  country: string;
  correctIndex: number;
  en: { question: string; choices: string[] };
  lt: { question: string; choices: string[] };
};

function rowsToExport(rows: TriviaRow[]): ExportEntry[] {
  return rows
    .filter((r) => r.card)
    .map((r) => ({
      country: r.country,
      correctIndex: r.card!.correctIndex,
      en: r.card!.en,
      lt: r.card!.lt,
    }));
}

// Pretty pre-validation of a pasted JSON string. Returns either the
// parsed deck or a human-readable error string — same checks the
// server does, just earlier so the save button can stay disabled.
function validateInput(raw: string): { deck: ExportEntry[] } | { error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return { error: `Not valid JSON: ${(e as Error).message}` };
  }
  if (!parsed || typeof parsed !== "object") {
    return { error: "Expected an object with a `deck` array." };
  }
  const deck = (parsed as { deck?: unknown }).deck;
  if (!Array.isArray(deck)) {
    return { error: "Top level needs a `deck` array." };
  }
  const seen = new Set<string>();
  const out: ExportEntry[] = [];
  for (let i = 0; i < deck.length; i++) {
    const entry = deck[i] as Record<string, unknown> | null;
    const where = `entry #${i + 1}`;
    if (!entry || typeof entry !== "object") {
      return { error: `${where}: expected an object.` };
    }
    const country = entry.country;
    if (typeof country !== "string" || country.length !== 2) {
      return { error: `${where}: \`country\` must be a 2-letter ISO code.` };
    }
    const cc = country.toLowerCase();
    if (seen.has(cc)) {
      return { error: `${where}: duplicate country "${cc}".` };
    }
    seen.add(cc);
    const correctIndex = entry.correctIndex;
    if (
      typeof correctIndex !== "number" ||
      !Number.isInteger(correctIndex) ||
      correctIndex < 0 ||
      correctIndex > 3
    ) {
      return { error: `${where}: \`correctIndex\` must be an integer 0..3.` };
    }
    for (const lang of ["en", "lt"] as const) {
      const block = entry[lang] as Record<string, unknown> | undefined;
      if (!block || typeof block !== "object") {
        return { error: `${where}: \`${lang}\` block missing.` };
      }
      if (typeof block.question !== "string" || !block.question.trim()) {
        return { error: `${where}: \`${lang}.question\` must be a non-empty string.` };
      }
      if (!Array.isArray(block.choices) || block.choices.length !== 4) {
        return { error: `${where}: \`${lang}.choices\` must have exactly 4 items.` };
      }
      for (let j = 0; j < 4; j++) {
        const c = block.choices[j];
        if (typeof c !== "string" || !c.trim()) {
          return {
            error: `${where}: \`${lang}.choices[${j}]\` must be a non-empty string.`,
          };
        }
      }
    }
    out.push({
      country: cc,
      correctIndex,
      en: {
        question: (entry.en as { question: string }).question,
        choices: (entry.en as { choices: string[] }).choices,
      },
      lt: {
        question: (entry.lt as { question: string }).question,
        choices: (entry.lt as { choices: string[] }).choices,
      },
    });
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
      [JSON.stringify({ deck: rowsToExport(rows) }, null, 2)],
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
      setDraft(JSON.stringify({ deck: rowsToExport(rows) }, null, 2));
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
    <section className="glass-card rounded-2xl p-5 sm:p-6 flex flex-col gap-5">
      <header className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-flamingo/15 ring-1 ring-flamingo/30 text-flamingo">
          <Lightbulb className="h-5 w-5" fill="currentColor" />
        </span>
        <div className="flex-1 min-w-0">
          <h2 className="font-display text-xl leading-tight">Question deck</h2>
          <p className="text-sm text-white/45 leading-snug mt-0.5">
            {filled}/{rows.length} countries have a question. Countries without
            one are skipped when they take the stage.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button type="button" size="sm" variant="ghost" onClick={exportDeck}>
            <Download className="h-4 w-4 mr-1.5" /> Export
          </Button>
          <Button type="button" size="sm" onClick={openEditor}>
            <Upload className="h-4 w-4 mr-1.5" /> Import JSON
          </Button>
        </div>
      </header>

      {open && (
        <div className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-4 flex flex-col gap-3">
          <p className="text-xs text-white/55 leading-relaxed">
            Paste a deck JSON. Same shape as Export. Schema:{" "}
            <code className="text-white/70">
              {`{ deck: [{ country, correctIndex (0-3), en: { question, choices[4] }, lt: { question, choices[4] } }] }`}
            </code>
          </p>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="font-mono text-xs leading-relaxed bg-black/40 ring-1 ring-white/12 rounded-xl p-3 min-h-[280px] text-white/85 focus:outline-none focus:ring-flamingo/40"
            spellCheck={false}
            placeholder='{ "deck": [...] }'
          />
          <div className="flex items-center gap-3">
            <span className="text-xs text-white/55">
              {validation.kind === "empty" && "Paste JSON to enable Save."}
              {validation.kind === "error" && (
                <span className="text-flamingo">{validation.message}</span>
              )}
              {validation.kind === "ok" && (
                <span className="text-turquoise">
                  Valid. {validation.count} questions ready to write.
                </span>
              )}
            </span>
            <div className="ml-auto flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setOpen(false)}
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
            </div>
          </div>
        </div>
      )}

      <ol className="flex flex-col gap-2">
        {rows.map((r) => (
          <li
            key={r.country}
            className="flex items-start gap-3 rounded-xl bg-white/[0.03] ring-1 ring-white/8 p-3"
          >
            <HeartFlag code={r.country} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="font-display text-sm text-white/90">{r.name}</p>
              {r.card ? (
                <>
                  <p className="text-[13px] text-white/65 leading-snug mt-0.5 truncate">
                    {r.card.en.question}
                  </p>
                  <ul className="text-[11px] text-white/45 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                    {r.card.en.choices.map((c, i) => (
                      <li
                        key={i}
                        className={
                          i === r.card!.correctIndex
                            ? "text-turquoise inline-flex items-center gap-1"
                            : ""
                        }
                      >
                        {i === r.card!.correctIndex && (
                          <Check className="h-3 w-3" />
                        )}
                        {String.fromCharCode(65 + i)}. {c}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="text-[13px] text-white/35 italic mt-0.5">
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
  );
}
