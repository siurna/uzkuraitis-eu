"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Save, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { countries } from "@/lib/countries";
import { Flag } from "@/components/flag";
import { NONE_TOKEN } from "@/lib/scoring";

type FactInput =
  | { kind: "country"; key: string; label: string; sub: string; allowNone?: boolean }
  | { kind: "boolean"; key: string; label: string; sub: string };

const FACTS: FactInput[] = [
  {
    kind: "country",
    key: "jury_winner",
    label: "Jury winner",
    sub: "Country that won the jury vote.",
  },
  {
    kind: "country",
    key: "televote_winner",
    label: "Televote winner",
    sub: "Country that won the televote.",
  },
  {
    kind: "country",
    key: "nul_televote",
    label: "Nul-points televote",
    sub: "Country that got 0 from the public, or 'No country' if everyone scored.",
    allowNone: true,
  },
  {
    kind: "country",
    key: "lt_12_to",
    label: "12 from Lithuania to",
    sub: "Country Lithuania awarded its 12 points to.",
  },
  {
    kind: "boolean",
    key: "winner_solo",
    label: "Winner is a solo act?",
    sub: "Yes if the winning entry was performed by a solo singer; no for duos / groups.",
  },
];

export function AdminOfficialFacts({
  initial,
}: {
  initial: Record<string, string>;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Record<string, string>>(initial);
  const [pending, start] = useTransition();

  const set = (key: string, value: string) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const save = () => {
    // Convert empty strings to nulls for the API.
    const payload: Record<string, string | null> = {};
    for (const f of FACTS) {
      payload[f.key] = draft[f.key] && draft[f.key] !== "" ? draft[f.key] : null;
    }
    start(async () => {
      const res = await fetch("/api/admin/official-facts", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ facts: payload }),
      });
      if (!res.ok) {
        toast.error("Couldn't save facts.");
        return;
      }
      toast.success("Facts saved. Leaderboards refreshed.");
      router.refresh();
    });
  };

  return (
    <section className="glass-card rounded-xl p-5 flex flex-col gap-4">
      <header className="flex items-center gap-2">
        <Trophy className="h-5 w-5 text-flamingo" />
        <h2 className="font-display text-xl">Side-bet ground truth</h2>
      </header>
      <p className="text-xs text-white/50 -mt-1">
        Fill these in once the show ends so bonus bets can be scored.
        Leave blank to skip.
      </p>

      <div className="flex flex-col gap-2">
        {FACTS.map((f) =>
          f.kind === "country" ? (
            <CountryFact
              key={f.key}
              fact={f}
              value={draft[f.key] ?? ""}
              onChange={(v) => set(f.key, v)}
            />
          ) : (
            <BooleanFact
              key={f.key}
              fact={f}
              value={draft[f.key] ?? ""}
              onChange={(v) => set(f.key, v)}
            />
          ),
        )}
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          size="sm"
          onClick={save}
          disabled={pending}
          className="bg-gradient-to-r from-gold via-flamingo to-purple text-white"
        >
          <Save className="h-4 w-4 mr-1.5" />
          {pending ? "Saving…" : "Save facts"}
        </Button>
      </div>
    </section>
  );
}

function CountryFact({
  fact,
  value,
  onChange,
}: {
  fact: Extract<FactInput, { kind: "country" }>;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="list-entry-gradient glass-card rounded-xl p-3 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="font-display truncate">{fact.label}</p>
        <p className="text-xs text-white/55 truncate">{fact.sub}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {value && value !== NONE_TOKEN && (
          <Flag code={value} size="sm" />
        )}
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 rounded-md border border-white/15 bg-black/30 px-2 text-sm max-w-[10rem]"
        >
          <option value="">— blank —</option>
          {fact.allowNone && (
            <option value={NONE_TOKEN}>No country</option>
          )}
          {countries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function BooleanFact({
  fact,
  value,
  onChange,
}: {
  fact: Extract<FactInput, { kind: "boolean" }>;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="list-entry-gradient glass-card rounded-xl p-3 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="font-display truncate">{fact.label}</p>
        <p className="text-xs text-white/55 truncate">{fact.sub}</p>
      </div>
      <div className="flex items-center gap-1 rounded-full bg-black/30 p-1 shrink-0 text-xs">
        {(["true", "false", ""] as const).map((opt) => {
          const active = value === opt;
          return (
            <button
              key={opt || "blank"}
              type="button"
              onClick={() => onChange(opt)}
              className={`px-3 py-1 rounded-full transition ${
                active
                  ? "bg-flamingo text-white shadow-glow-pink"
                  : "text-white/60 hover:text-white"
              }`}
            >
              {opt === "" ? "—" : opt === "true" ? "yes" : "no"}
            </button>
          );
        })}
      </div>
    </div>
  );
}
