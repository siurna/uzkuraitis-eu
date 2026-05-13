"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trophy, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCountry } from "@/lib/countries";
import { Flag } from "@/components/flag";
import { CountryDrawer } from "@/components/country-drawer";
import { NONE_TOKEN } from "@/lib/scoring";

type FactInput =
  | { kind: "country"; key: string; label: string; sub: string; allowNone?: boolean; multi?: boolean }
  | { kind: "boolean"; key: string; label: string; sub: string }
  | { kind: "number"; key: string; label: string; sub: string; min?: number; max?: number };

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
    sub: "All countries that got 0 from the public, comma-separated, or pick 'No country' if every country scored. Voters earn +4 per correct guess (capped at +12).",
    allowNone: true,
    multi: true,
  },
  {
    kind: "country",
    key: "lt_12_to",
    label: "12 from Lithuania to",
    sub: "Country Lithuania awarded its 12 points to.",
  },
  {
    kind: "number",
    key: "lt_total_points",
    label: "Lithuania total points",
    sub: "Final total Lithuania ended up with. Voters score on closeness: exact +10, ±5 +7, ±15 +5, ±30 +3, ±60 +1.",
    min: 0,
    max: 1000,
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
  endpoint = "/api/admin/official-facts",
  headers,
}: {
  initial: Record<string, string>;
  endpoint?: string;
  headers?: Record<string, string>;
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
      const res = await fetch(endpoint, {
        method: "PUT",
        headers: { "content-type": "application/json", ...(headers ?? {}) },
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

      <div className="flex flex-col gap-2">
        {FACTS.map((f) => {
          if (f.kind === "country") {
            return (
              <CountryFact
                key={f.key}
                fact={f}
                value={draft[f.key] ?? ""}
                onChange={(v) => set(f.key, v)}
              />
            );
          }
          if (f.kind === "number") {
            return (
              <NumberFact
                key={f.key}
                fact={f}
                value={draft[f.key] ?? ""}
                onChange={(v) => set(f.key, v)}
              />
            );
          }
          return (
            <BooleanFact
              key={f.key}
              fact={f}
              value={draft[f.key] ?? ""}
              onChange={(v) => set(f.key, v)}
            />
          );
        })}
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          size="sm"
          onClick={save}
          disabled={pending}
          className="bg-white text-dark-blue hover:bg-dark-blue-50"
        >
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
  const [drawerOpen, setDrawerOpen] = useState(false);
  if (fact.multi) {
    // Value is stored as comma-separated; the country drawer hands us
    // an array which we serialise back.
    const picks = value
      ? value.split(",").map((s) => s.trim()).filter(Boolean)
      : [];
    return (
      <>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="list-card-hover glass-card rounded-xl p-3 flex items-center gap-3 text-left w-full"
        >
          <div className="flex-1 min-w-0">
            <p className="font-display">{fact.label}</p>
            <p className="text-xs text-white/55 leading-relaxed">{fact.sub}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {picks.length === 0 ? (
              <span className="text-xs text-white/40 italic">tap to pick</span>
            ) : (
              <span className="flex items-center -space-x-1.5 max-w-[6rem]">
                {picks.slice(0, 4).map((code) =>
                  code === NONE_TOKEN ? (
                    <span
                      key={code}
                      className="h-5 w-7 grid place-items-center rounded-[3px] bg-white/15 text-[10px] uppercase text-white/70 border border-dark-blue-900"
                    >
                      —
                    </span>
                  ) : (
                    <Flag
                      key={code}
                      code={code}
                      size="sm"
                      className="ring-2 ring-dark-blue-900"
                    />
                  ),
                )}
                {picks.length > 4 && (
                  <span className="ml-2 text-xs text-white/60 tabular-nums">
                    +{picks.length - 4}
                  </span>
                )}
              </span>
            )}
            <ChevronRight className="h-4 w-4 text-dark-blue-300" />
          </div>
        </button>
        <CountryDrawer
          title={fact.label}
          sub={fact.sub}
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          selected={picks}
          onPick={(v) => {
            const arr = Array.isArray(v) ? v : v ? [v] : [];
            onChange(arr.join(","));
          }}
          allowNone={fact.allowNone}
          mode="multi"
        />
      </>
    );
  }

  // Single-select: tap-to-open drawer, single mode.
  const c = value && value !== NONE_TOKEN ? getCountry(value) : null;
  return (
    <>
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        className="list-card-hover glass-card rounded-xl p-3 flex items-center gap-3 text-left w-full"
      >
        <div className="flex-1 min-w-0">
          <p className="font-display">{fact.label}</p>
          <p className="text-xs text-white/55 leading-relaxed">{fact.sub}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {c ? (
            <span className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-flamingo/20 border border-flamingo/40">
              <Flag code={c.code} size="sm" />
              <span className="text-sm font-display max-w-[7rem] truncate">
                {c.name}
              </span>
            </span>
          ) : value === NONE_TOKEN ? (
            <span className="text-sm text-white/70 px-2.5 py-1 rounded-full bg-white/10">
              No country
            </span>
          ) : (
            <span className="text-xs text-white/40 italic">tap to pick</span>
          )}
          <ChevronRight className="h-4 w-4 text-dark-blue-300" />
        </div>
      </button>
      <CountryDrawer
        title={fact.label}
        sub={fact.sub}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        selected={value ? [value] : []}
        onPick={(v) => onChange(typeof v === "string" ? v : "")}
        allowNone={fact.allowNone}
      />
    </>
  );
}

function NumberFact({
  fact,
  value,
  onChange,
}: {
  fact: Extract<FactInput, { kind: "number" }>;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="glass-card rounded-xl p-3 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="font-display truncate">{fact.label}</p>
        <p className="text-xs text-white/55 leading-relaxed">{fact.sub}</p>
      </div>
      <Input
        type="number"
        inputMode="numeric"
        min={fact.min}
        max={fact.max}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="—"
        className="h-10 w-24 text-center font-display tabular-nums shrink-0"
      />
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
    <div className="glass-card rounded-xl p-3 flex items-center gap-3">
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
