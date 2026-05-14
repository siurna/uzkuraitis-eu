"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Bold, Italic, Underline } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WelcomeMarkdown } from "@/components/welcome-banner";

// Admin › Welcome: edit the closing widget shown on every room home.
// Two textareas — EN + LT markdown — stored as `welcome_md_en` and
// `welcome_md_lt` in `site_content`. Empty saves clear the row, which
// hides the widget for that language. Inline markup matches the rest
// of the app: **bold**, *italic*, __underline__, blank-line paragraphs
// and `- ` bullets.
export function AdminWelcome({
  initial,
}: {
  initial: { welcome_md_en: string; welcome_md_lt: string };
}) {
  const [en, setEn] = useState(initial.welcome_md_en);
  const [lt, setLt] = useState(initial.welcome_md_lt);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<"en" | "lt">("en");

  const wrap = (which: "en" | "lt", marker: string) => {
    const el = document.getElementById(`welcome-md-${which}`) as HTMLTextAreaElement | null;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const value = el.value;
    const hadSel = end > start;
    const sel = hadSel ? value.slice(start, end) : "text";
    const next = value.slice(0, start) + marker + sel + marker + value.slice(end);
    if (which === "en") setEn(next); else setLt(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + marker.length, start + marker.length + sel.length);
    });
  };

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
        // Any room tab already mounted picks up the new content
        // without a reload. Same event the home banner + chat card
        // listen for.
        window.dispatchEvent(new Event("uzk:welcome-refresh"));
      } else toast.error("Save failed.");
    } catch {
      toast.error("Save failed (network).");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="glass-card rounded-xl p-5 flex flex-col gap-5">
      <header className="flex items-start justify-between gap-3">
        <p className="text-sm text-white/55 leading-snug max-w-xl">
          Shown as the closing widget on every room home. Each language is
          independent — leave one blank to hide it in that language. Supports{" "}
          <code className="text-white/70">**bold**</code>,{" "}
          <code className="text-white/70">*italic*</code>,{" "}
          <code className="text-white/70">__underline__</code>, blank-line
          paragraphs and <code className="text-white/70">- bullets</code>.
        </p>
        <Button type="button" onClick={save} disabled={saving} className="h-9 shrink-0">
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
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-white/45 font-display">{label}</span>
              <div className="flex items-center gap-1">
                {([
                  { m: "**", Icon: Bold, label: "Bold" },
                  { m: "*", Icon: Italic, label: "Italic" },
                  { m: "__", Icon: Underline, label: "Underline" },
                ] as const).map(({ m, Icon, label: l }) => (
                  <button
                    key={m}
                    type="button"
                    aria-label={l}
                    title={l}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => wrap(key, m)}
                    className="grid h-7 w-7 place-items-center rounded-md bg-white/[0.06] ring-1 ring-white/12
                               text-white/65 hover:text-white hover:bg-white/[0.1] transition"
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </button>
                ))}
              </div>
            </div>
            <textarea
              id={`welcome-md-${key}`}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              rows={8}
              placeholder={
                key === "en"
                  ? "Hello folks! A few housekeeping notes…"
                  : "Sveiki! Keletas svarbių dalykų…"
              }
              className="rounded-lg bg-black/30 border border-white/15 px-3 py-2 text-sm leading-snug text-white
                         resize-y min-h-[12rem]
                         focus:border-flamingo focus:outline-none focus:ring-2 focus:ring-flamingo/40 transition"
            />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wider text-white/45 font-display">Preview</span>
          <div className="flex items-center gap-1">
            {(["en", "lt"] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setPreview(l)}
                className={`h-7 px-3 rounded-md text-xs font-display uppercase tracking-wider transition
                            ${preview === l ? "bg-flamingo/20 text-white ring-1 ring-flamingo/40" : "text-white/55 hover:text-white"}`}
              >
                {l === "en" ? "English" : "Lithuanian"}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-2xl ring-1 ring-white/10 bg-black/30 p-4">
          {(preview === "en" ? en : lt).trim() ? (
            <WelcomeMarkdown source={preview === "en" ? en : lt} />
          ) : (
            <p className="text-sm text-white/40 italic">Nothing to preview yet.</p>
          )}
        </div>
      </div>
    </section>
  );
}
