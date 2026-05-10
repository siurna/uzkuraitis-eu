"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Save, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { countries } from "@/lib/countries";
import { Flag } from "@/components/flag";

// Editor for the official Eurovision top-10 result. Eurovision scores
// only the top 10 with points (12, 10, 8, ..., 1), so the editor is
// LOCKED to exactly 10 rows: one per placement, no add/delete. The
// admin just picks the country for each fixed slot.

type Row = {
  placement: number;
  countryCode: string;
};

export function AdminOfficialResults({
  initial,
  endpoint = "/api/admin/official-results",
  headers,
}: {
  initial: Row[];
  endpoint?: string;
  headers?: Record<string, string>;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(() => {
    const byPlacement = new Map<number, string>(
      initial.map((r) => [r.placement, r.countryCode]),
    );
    return Array.from({ length: 10 }, (_, i) => ({
      placement: i + 1,
      countryCode: byPlacement.get(i + 1) ?? "",
    }));
  });
  const [pending, start] = useTransition();

  const setRowCountry = (placement: number, countryCode: string) => {
    setRows((prev) =>
      prev.map((r) => {
        // Selecting a country that's already in another slot vacates
        // that other slot to keep the truth table consistent.
        if (r.placement === placement) return { ...r, countryCode };
        if (r.countryCode === countryCode && countryCode !== "")
          return { ...r, countryCode: "" };
        return r;
      }),
    );
  };

  const save = () => {
    const filled = rows.filter((r) => r.countryCode);
    const placements = filled.map((r) => r.placement);
    if (new Set(placements).size !== placements.length) {
      toast.error("Two countries can't share a placement.");
      return;
    }
    start(async () => {
      const res = await fetch(endpoint, {
        method: "PUT",
        headers: { "content-type": "application/json", ...(headers ?? {}) },
        body: JSON.stringify({ results: filled }),
      });
      if (!res.ok) {
        const { error } = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        toast.error(error ?? "Couldn't save the results.");
        return;
      }
      toast.success("Official results saved.");
      router.refresh();
    });
  };

  const wipe = () => {
    if (
      !window.confirm(
        "Clear all official results? Leaderboards in every room will reset to 'waiting'.",
      )
    ) {
      return;
    }
    start(async () => {
      const res = await fetch(endpoint, {
        method: "DELETE",
        headers: headers ?? {},
      });
      if (!res.ok) {
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
      router.refresh();
    });
  };

  const filledCount = rows.filter((r) => r.countryCode).length;

  return (
    <section className="glass-card rounded-xl p-5">
      <header className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-flamingo" />
          <h2 className="font-display text-xl">Official results</h2>
        </div>
        <span className="text-xs text-white/50 tabular-nums">
          {filledCount} entered
        </span>
      </header>

      <p className="text-xs text-white/50 mb-4">
        Top 10 placements only. Pick the country for each slot; the
        placement number is locked. Saving broadcasts the new leaderboard
        to every room.
      </p>

      <ol className="flex flex-col gap-2">
        {rows.map((row) => (
          <li
            key={row.placement}
            className="list-entry-gradient glass-card rounded-xl p-3 flex items-center gap-3"
          >
            <span
              className={`shrink-0 w-10 text-center font-display text-2xl tabular-nums ${
                row.placement === 1
                  ? "text-gold"
                  : row.placement === 2
                    ? "text-flamingo"
                    : row.placement === 3
                      ? "text-orange"
                      : "text-white/60"
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
              className="h-10 flex-1 rounded-md border border-white/15 bg-black/30 px-2 text-sm"
            >
              <option value="">— pick country —</option>
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap gap-2 mt-4">
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
          className="bg-gradient-to-r from-gold via-flamingo to-purple text-white"
        >
          <Save className="h-4 w-4 mr-1.5" />
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </section>
  );
}
