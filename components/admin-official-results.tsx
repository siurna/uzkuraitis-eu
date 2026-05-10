"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { Trash2, Save, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { countries } from "@/lib/countries";
import { Flag } from "@/components/flag";

// Editor for the official Eurovision result. Admin enters one row per
// official top-N placement (placement -> country). The leaderboard scores
// against this. Empty state = no result entered yet, leaderboard is hidden.
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
  /** Override target endpoint (default: global official results). */
  endpoint?: string;
  /** Extra request headers (e.g. X-Admin-Token for per-room admins). */
  headers?: Record<string, string>;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(
    initial.length
      ? [...initial].sort((a, b) => a.placement - b.placement)
      : Array.from({ length: 10 }, (_, i) => ({
          placement: i + 1,
          countryCode: "",
        })),
  );
  const [pending, start] = useTransition();

  const setRow = (i: number, patch: Partial<Row>) => {
    setRows((prev) =>
      prev.map((r, j) => (i === j ? { ...r, ...patch } : r)),
    );
  };

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      { placement: prev.length + 1, countryCode: "" },
    ]);
  };

  const removeRow = (i: number) => {
    setRows((prev) => prev.filter((_, j) => j !== i));
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
        Pick the country for each placement. Leave a row empty to skip it.
        Saving broadcasts the new leaderboard to every room.
      </p>

      <ol className="flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {rows.map((row, i) => (
            <motion.li
              key={`${row.placement}-${i}`}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="flex items-center gap-2"
            >
              <Input
                type="number"
                min={1}
                max={50}
                value={row.placement}
                onChange={(e) =>
                  setRow(i, { placement: Number(e.target.value) || 0 })
                }
                className="h-10 w-20 text-center font-display tabular-nums"
              />
              <select
                value={row.countryCode}
                onChange={(e) => setRow(i, { countryCode: e.target.value })}
                className="h-10 flex-1 rounded-md border border-white/15 bg-black/30 px-2 text-sm"
              >
                <option value="">— skip —</option>
                {countries.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
              {row.countryCode && (
                <Flag code={row.countryCode} size="sm" />
              )}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => removeRow(i)}
                className="text-white/40 hover:text-error"
                aria-label="Remove row"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>

      <div className="flex flex-wrap gap-2 mt-4">
        <Button type="button" size="sm" variant="outline" onClick={addRow}>
          + Row
        </Button>
        <div className="flex-1" />
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
