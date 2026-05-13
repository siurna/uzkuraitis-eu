"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { countries } from "@/lib/countries";

const NAME_KEY = "__name__";
const PHOTO_KEY = "__photo__";

// Admin › Settings: edit the live-commentator bot — its name + photo and
// one line per country. When the host puts a country on stage, the bot
// drops that country's line into chat. A country with no line is skipped;
// clearing the name switches the whole thing off.
export function AdminCommentator({ initial }: { initial: Record<string, string> }) {
  const [lines, setLines] = useState<Record<string, string>>(initial);
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setLines((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/commentator", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lines }),
      });
      if (res.ok) toast.success("Commentary saved.");
      else toast.error("Save failed.");
    } catch {
      toast.error("Save failed (network).");
    } finally {
      setSaving(false);
    }
  };

  const filled = countries.filter((c) => (lines[c.code] ?? "").trim()).length;
  const active = !!(lines[NAME_KEY] ?? "").trim();

  return (
    <section className="glass-card rounded-xl p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl">Live commentator</h2>
          <p className="text-sm text-white/50 mt-0.5">
            {active
              ? `On. ${filled}/${countries.length} country lines written — countries without one are skipped.`
              : "Off. Give the bot a name to switch it on; it posts a line to chat whenever a country goes on stage."}
          </p>
        </div>
        <Button type="button" onClick={save} disabled={saving} className="h-9 shrink-0">
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-wider text-white/45 font-display">Bot name</span>
          <Input
            value={lines[NAME_KEY] ?? ""}
            onChange={(e) => set(NAME_KEY, e.target.value)}
            placeholder="🎙️ Eurodude"
            className="h-9"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-wider text-white/45 font-display">Bot photo URL (optional)</span>
          <Input
            value={lines[PHOTO_KEY] ?? ""}
            onChange={(e) => set(PHOTO_KEY, e.target.value)}
            placeholder="https://…"
            className="h-9"
          />
        </label>
      </div>

      <p className="text-xs text-white/35">
        Lines support <code className="text-white/55">**bold**</code> and <code className="text-white/55">*italic*</code>.
      </p>
      <div className="flex flex-col gap-3">
        {countries.map((c) => (
          <label key={c.code} className="flex items-start gap-2.5">
            <span className="w-6 shrink-0 pt-2 text-center text-[11px] text-white/40 tabular-nums">{c.order}</span>
            <span className="w-28 sm:w-40 shrink-0 truncate pt-2 text-sm text-white/70">
              {c.flag} {c.name}
            </span>
            <textarea
              value={lines[c.code] ?? ""}
              onChange={(e) => set(c.code, e.target.value)}
              rows={2}
              placeholder="…what the commentator says when they hit the stage"
              className="flex-1 min-w-0 rounded-lg bg-black/30 border border-white/15 px-3 py-2
                         text-sm leading-snug text-white resize-y min-h-[2.5rem]
                         focus:border-flamingo focus:outline-none focus:ring-2 focus:ring-flamingo/40 transition"
            />
          </label>
        ))}
      </div>
    </section>
  );
}
