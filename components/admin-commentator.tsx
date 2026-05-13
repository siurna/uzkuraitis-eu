"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { ImagePlus, X, Bold, Italic, Underline } from "lucide-react";
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
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (k: string, v: string) => setLines((p) => ({ ...p, [k]: v }));

  // Rudimentary bold/italic/underline: wrap the selection in the
  // last-focused country textarea with the given marker (** / * / __),
  // mirroring the inline markup chat understands.
  const activeEl = useRef<HTMLTextAreaElement | null>(null);
  const activeKey = useRef<string | null>(null);
  const wrap = (marker: string) => {
    const el = activeEl.current;
    const key = activeKey.current;
    if (!el || !key) {
      toast.error("Tap into a country line first.");
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const value = el.value;
    const hadSelection = end > start;
    const sel = hadSelection ? value.slice(start, end) : "text";
    const next = value.slice(0, start) + marker + sel + marker + value.slice(end);
    set(key, next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + marker.length, start + marker.length + sel.length);
    });
  };

  const uploadPhoto = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body: form });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (res.ok && data.url) {
        set(PHOTO_KEY, data.url);
        toast.success("Photo uploaded — Save to apply.");
      } else {
        toast.error(data.error ?? "Upload failed.");
      }
    } catch {
      toast.error("Upload failed (network).");
    } finally {
      setUploading(false);
    }
  };

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

      <div className="flex flex-wrap items-end gap-4">
        <span className="relative grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-white/[0.06] ring-1 ring-white/12 text-white/40">
          {lines[PHOTO_KEY] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={lines[PHOTO_KEY]} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-2xl">🎙️</span>
          )}
          {lines[PHOTO_KEY] && (
            <button
              type="button"
              onClick={() => set(PHOTO_KEY, "")}
              aria-label="Remove photo"
              className="absolute top-0.5 right-0.5 h-5 w-5 grid place-items-center rounded-full bg-black/70 text-white/80 hover:text-white"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </span>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-wider text-white/45 font-display">Bot photo</span>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void uploadPhoto(f);
            }}
          />
          <Button type="button" variant="secondary" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
            <ImagePlus className="h-4 w-4 mr-1.5" />
            {uploading ? "Uploading…" : lines[PHOTO_KEY] ? "Replace photo" : "Upload photo"}
          </Button>
        </div>
        <label className="flex flex-col gap-1.5 flex-1 min-w-[12rem]">
          <span className="text-xs uppercase tracking-wider text-white/45 font-display">Bot name</span>
          <Input
            value={lines[NAME_KEY] ?? ""}
            onChange={(e) => set(NAME_KEY, e.target.value)}
            placeholder="🎙️ Eurodude"
            className="h-9"
          />
        </label>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-white/35">
          Lines support <code className="text-white/55">**bold**</code>, <code className="text-white/55">*italic*</code> &amp;{" "}
          <code className="text-white/55">__underline__</code>. Select text in a line, then:
        </span>
        <div className="flex items-center gap-1">
          {([
            { m: "**", Icon: Bold, label: "Bold" },
            { m: "*", Icon: Italic, label: "Italic" },
            { m: "__", Icon: Underline, label: "Underline" },
          ] as const).map(({ m, Icon, label }) => (
            <button
              key={m}
              type="button"
              aria-label={label}
              title={label}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => wrap(m)}
              className="grid h-7 w-7 place-items-center rounded-md bg-white/[0.06] ring-1 ring-white/12
                         text-white/65 hover:text-white hover:bg-white/[0.1] transition"
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>
      </div>
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
              onFocus={(e) => {
                activeEl.current = e.currentTarget;
                activeKey.current = c.code;
              }}
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
