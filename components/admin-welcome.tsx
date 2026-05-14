"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Hand } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WelcomeMarkdown } from "@/components/welcome-banner";

// Admin › Welcome: edit the closing widget shown on every room home.
// Two textareas — EN + LT markdown — stored as `welcome_md_en` and
// `welcome_md_lt` in `site_content`. Empty saves clear the row, which
// hides the widget for that language.
export function AdminWelcome({
  initial,
}: {
  initial: { welcome_md_en: string; welcome_md_lt: string };
}) {
  const [en, setEn] = useState(initial.welcome_md_en);
  const [lt, setLt] = useState(initial.welcome_md_lt);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/welcome", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ welcome_md_en: en, welcome_md_lt: lt }),
      });
      if (res.ok) {
        toast.success("Welcome saved.");
        window.dispatchEvent(new Event("uzk:welcome-refresh"));
      } else toast.error("Save failed.");
    } catch {
      toast.error("Save failed (network).");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="glass-card rounded-2xl p-5 sm:p-6 flex flex-col gap-5">
      <header className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-flamingo/15 ring-1 ring-flamingo/30 text-flamingo">
          <Hand className="h-5 w-5" />
        </span>
        <div className="flex-1 min-w-0">
          <h2 className="font-display text-xl leading-tight">Welcome</h2>
          <p className="text-sm text-white/45 leading-snug mt-0.5">
            Closing widget on every room home. Leave a language blank to hide
            it.
          </p>
        </div>
        <Button type="button" onClick={save} disabled={saving} className="shrink-0">
          {saving ? "Saving…" : "Save"}
        </Button>
      </header>

      <div className="grid gap-5 lg:grid-cols-2 items-start">
        {(
          [
            { key: "en" as const, label: "English", value: en, setValue: setEn },
            { key: "lt" as const, label: "Lithuanian", value: lt, setValue: setLt },
          ]
        ).map(({ key, label, value, setValue }) => (
          <div key={key} className="flex flex-col gap-2">
            <span className="text-xs uppercase tracking-wider text-white/45 font-display">{label}</span>
            <textarea
              id={`welcome-md-${key}`}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              rows={8}
              className="rounded-lg bg-black/30 border border-white/15 px-3 py-2 text-sm leading-snug text-white
                         resize-y min-h-[12rem]
                         focus:border-flamingo focus:outline-none focus:ring-2 focus:ring-flamingo/40 transition"
            />
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2 items-start">
        {(["en", "lt"] as const).map((l) => {
          const src = l === "en" ? en : lt;
          return (
            <div key={l} className="flex flex-col gap-2">
              <span className="text-xs uppercase tracking-wider text-white/45 font-display">
                {l === "en" ? "English preview" : "Lithuanian preview"}
              </span>
              <div className="rounded-2xl ring-1 ring-white/10 bg-black/30 p-4 min-h-[6rem]">
                {src.trim() ? (
                  <WelcomeMarkdown source={src} showDivider />
                ) : (
                  <p className="text-sm text-white/40 italic">Nothing to preview yet.</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
