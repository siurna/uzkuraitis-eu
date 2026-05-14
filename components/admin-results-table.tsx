"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { countries, getCountry } from "@/lib/countries";
import { Flag } from "@/components/flag";
import { CountryDrawer } from "@/components/country-drawer";
import { AdminPageTitle } from "@/components/admin-page-title";
import { NONE_TOKEN } from "@/lib/scoring";

// Merged editor for the Eurovision official-results page. Used to be
// two cards stacked (top-10 placement editor + the side-bet ground
// truth) with their own icon-tile headers, subtitles, and Save
// buttons. The information lands at the same beat in real life
// (right after the show closes) so the admin gets it all in one
// table: ten placement rows + a handful of fact rows, one Save.

type ResultRow = { placement: number; countryCode: string };

type FactInput =
  | {
      kind: "country";
      key: string;
      label: string;
      allowNone?: boolean;
      multi?: boolean;
    }
  | { kind: "boolean"; key: string; label: string }
  | { kind: "number"; key: string; label: string; min?: number; max?: number };

// Every voter-side bet needs a row here, otherwise the leaderboard can't
// score it. Audited against `lib/scoring.ts` → scoreBets + scoreHomePrediction:
//
//   wooden_spoon_country     → bet_wooden_spoon
//   home_country_placement   → bet_home_country_prediction (LT placement)
//   lt_12_to                 → bet_lt_12_to
//   highestBig5              → derived from the placement editor (top 10)
//   jury_winner              → bet_jury_winner
//   televote_winner          → bet_televote_winner
//   nul_televote             → bet_nul_televote
//   hostTop3                 → derived from the placement editor (top 3)
//   winner_solo              → bet_winner_solo
//   lt_total_points          → bet_lt_total_points
const FACTS: FactInput[] = [
  {
    kind: "country",
    key: "wooden_spoon_country",
    label: "Wooden spoon (last place)",
  },
  {
    kind: "number",
    key: "home_country_placement",
    label: "Lithuania final placement",
    min: 1,
    max: 30,
  },
  { kind: "country", key: "jury_winner", label: "Jury winner" },
  { kind: "country", key: "televote_winner", label: "Televote winner" },
  {
    kind: "country",
    key: "nul_televote",
    label: "Nul-points televote",
    allowNone: true,
    multi: true,
  },
  { kind: "country", key: "lt_12_to", label: "12 from Lithuania to" },
  {
    kind: "number",
    key: "lt_total_points",
    label: "Lithuania total points",
    min: 0,
    max: 1000,
  },
  { kind: "boolean", key: "winner_solo", label: "Winner is a solo act?" },
];

export function AdminResultsTable({
  initialResults,
  initialFacts,
  resultsEndpoint = "/api/admin/official-results",
  factsEndpoint = "/api/admin/official-facts",
  headers,
}: {
  initialResults: ResultRow[];
  initialFacts: Record<string, string>;
  resultsEndpoint?: string;
  factsEndpoint?: string;
  headers?: Record<string, string>;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<ResultRow[]>(() => {
    const byPlacement = new Map<number, string>(
      initialResults.map((r) => [r.placement, r.countryCode]),
    );
    return Array.from({ length: 10 }, (_, i) => ({
      placement: i + 1,
      countryCode: byPlacement.get(i + 1) ?? "",
    }));
  });
  const [factDraft, setFactDraft] = useState<Record<string, string>>(initialFacts);
  const [pending, start] = useTransition();

  const setRowCountry = (placement: number, countryCode: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.placement === placement) return { ...r, countryCode };
        if (r.countryCode === countryCode && countryCode !== "")
          return { ...r, countryCode: "" };
        return r;
      }),
    );
  };

  const setFact = (key: string, value: string) =>
    setFactDraft((prev) => ({ ...prev, [key]: value }));

  const save = () => {
    const filled = rows.filter((r) => r.countryCode);
    const placements = filled.map((r) => r.placement);
    if (new Set(placements).size !== placements.length) {
      toast.error("Two countries can't share a placement.");
      return;
    }
    const factPayload: Record<string, string | null> = {};
    for (const f of FACTS) {
      factPayload[f.key] =
        factDraft[f.key] && factDraft[f.key] !== "" ? factDraft[f.key] : null;
    }
    start(async () => {
      const reqHeaders = {
        "content-type": "application/json",
        ...(headers ?? {}),
      };
      const [resultsRes, factsRes] = await Promise.all([
        fetch(resultsEndpoint, {
          method: "PUT",
          headers: reqHeaders,
          body: JSON.stringify({ results: filled }),
        }),
        fetch(factsEndpoint, {
          method: "PUT",
          headers: reqHeaders,
          body: JSON.stringify({ facts: factPayload }),
        }),
      ]);
      if (!resultsRes.ok || !factsRes.ok) {
        const { error } = (await resultsRes.json().catch(() => ({}))) as {
          error?: string;
        };
        toast.error(error ?? "Couldn't save.");
        return;
      }
      toast.success("Saved. Leaderboards refreshed.");
      router.refresh();
    });
  };

  const wipe = () => {
    if (
      !window.confirm(
        "Clear all official results and facts? Leaderboards in every room reset to 'waiting'.",
      )
    ) {
      return;
    }
    start(async () => {
      const [r1, r2] = await Promise.all([
        fetch(resultsEndpoint, { method: "DELETE", headers: headers ?? {} }),
        fetch(factsEndpoint, {
          method: "PUT",
          headers: { "content-type": "application/json", ...(headers ?? {}) },
          body: JSON.stringify({
            facts: Object.fromEntries(FACTS.map((f) => [f.key, null])),
          }),
        }),
      ]);
      if (!r1.ok || !r2.ok) {
        toast.error("Couldn't clear.");
        return;
      }
      toast.success("Cleared.");
      setRows(
        Array.from({ length: 10 }, (_, i) => ({
          placement: i + 1,
          countryCode: "",
        })),
      );
      setFactDraft({});
      router.refresh();
    });
  };

  const filledCount =
    rows.filter((r) => r.countryCode).length +
    FACTS.filter((f) => factDraft[f.key] && factDraft[f.key] !== "").length;
  const total = 10 + FACTS.length;

  return (
    <div className="flex flex-col gap-6">
      {/* AdminPageTitle owns the chrome; we pass the dynamic "X / Y
          filled" chip in the right-side trailing slot so the count
          tracks edits live without a separate header row inside the
          card. The card itself then gets uniform p-5 — its top edge
          no longer carries an extra row of counter-padding. */}
      <AdminPageTitle
        trailing={
          <span className="inline-flex items-center rounded-full bg-flamingo/15 ring-1 ring-flamingo/35 px-3 h-7 text-xs font-display text-flamingo tabular-nums">
            {filledCount} / {total}
          </span>
        }
      >
        Results
      </AdminPageTitle>

      <section className="glass-card rounded-xl p-5 flex flex-col gap-4">
      <ol className="flex flex-col">
        {rows.map((row, i) => (
          <li
            key={row.placement}
            className={`flex items-center gap-3 py-2 ${i > 0 ? "border-t border-white/8" : ""}`}
          >
            <span
              className={`shrink-0 w-8 text-center font-display text-lg tabular-nums ${
                row.placement === 1
                  ? "text-gold"
                  : row.placement === 2
                    ? "text-flamingo"
                    : row.placement === 3
                      ? "text-orange"
                      : "text-white/55"
              }`}
            >
              {row.placement}
            </span>
            {row.countryCode ? (
              <Flag code={row.countryCode} size="md" />
            ) : (
              <span className="shrink-0 h-6 w-8 rounded-[3px] bg-white/5 border border-dashed border-white/15" />
            )}
            <select
              value={row.countryCode}
              onChange={(e) => setRowCountry(row.placement, e.target.value)}
              className="h-9 flex-1 rounded-md border border-white/12 bg-black/30 px-2 text-sm"
            >
              <option value="">—</option>
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </li>
        ))}
        {FACTS.map((f) => (
          <FactRow
            key={f.key}
            fact={f}
            value={factDraft[f.key] ?? ""}
            onChange={(v) => setFact(f.key, v)}
          />
        ))}
      </ol>

      <div className="flex flex-wrap gap-2 pt-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={wipe}
          disabled={pending}
          className="border-error/40 text-error hover:bg-error/10"
        >
          <Trash2 className="h-4 w-4 mr-1.5" />
          Clear all
        </Button>
        <div className="flex-1" />
        <Button
          type="button"
          size="sm"
          onClick={save}
          disabled={pending}
          className="bg-white text-dark-blue hover:bg-dark-blue-50"
        >
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
      </section>
    </div>
  );
}

function FactRow({
  fact,
  value,
  onChange,
}: {
  fact: FactInput;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <li className="flex items-center gap-3 py-2 border-t border-white/8">
      <p className="flex-1 min-w-0 text-sm text-white/85">{fact.label}</p>
      <FactControl fact={fact} value={value} onChange={onChange} />
    </li>
  );
}

function FactControl({
  fact,
  value,
  onChange,
}: {
  fact: FactInput;
  value: string;
  onChange: (v: string) => void;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (fact.kind === "country") {
    if (fact.multi) {
      const picks = value
        ? value.split(",").map((s) => s.trim()).filter(Boolean)
        : [];
      return (
        <>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="shrink-0 flex items-center gap-2 h-9 rounded-md border border-white/12 bg-black/30 px-2.5 text-xs"
          >
            {picks.length === 0 ? (
              <span className="text-white/40 italic">tap to pick</span>
            ) : (
              <span className="flex items-center -space-x-1.5">
                {picks.slice(0, 3).map((code) =>
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
                {picks.length > 3 && (
                  <span className="ml-2 tabular-nums">+{picks.length - 3}</span>
                )}
              </span>
            )}
          </button>
          <CountryDrawer
            title={fact.label}
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
    const c = value && value !== NONE_TOKEN ? getCountry(value) : null;
    return (
      <>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="shrink-0 flex items-center gap-2 h-9 rounded-md border border-white/12 bg-black/30 px-2.5 text-xs"
        >
          {c ? (
            <span className="flex items-center gap-1.5">
              <Flag code={c.code} size="sm" />
              <span className="max-w-[7rem] truncate">{c.name}</span>
            </span>
          ) : value === NONE_TOKEN ? (
            <span>No country</span>
          ) : (
            <span className="text-white/40 italic">tap to pick</span>
          )}
        </button>
        <CountryDrawer
          title={fact.label}
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          selected={value ? [value] : []}
          onPick={(v) => onChange(typeof v === "string" ? v : "")}
          allowNone={fact.allowNone}
        />
      </>
    );
  }

  if (fact.kind === "number") {
    return (
      <Input
        type="number"
        inputMode="numeric"
        min={fact.min}
        max={fact.max}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="—"
        className="h-9 w-20 text-center font-display tabular-nums shrink-0"
      />
    );
  }

  return (
    <div className="flex items-center gap-1 rounded-full bg-black/30 p-1 shrink-0 text-xs">
      {(["true", "false", ""] as const).map((opt) => {
        const active = value === opt;
        return (
          <button
            key={opt || "blank"}
            type="button"
            onClick={() => onChange(opt)}
            className={`px-2.5 py-1 rounded-full transition ${
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
  );
}
