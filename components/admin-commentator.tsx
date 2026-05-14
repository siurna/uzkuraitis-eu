"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ImagePlus, X, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FluentEmoji } from "@/components/fluent-emoji";
import { AdminPageTitle } from "@/components/admin-page-title";
import { countries } from "@/lib/countries";

const NAME_KEY = "__name__";
const PHOTO_KEY = "__photo__";
const AUTOSAVE_DELAY = 600;

// Admin › Banter: edit the live-commentator bot — its name + photo and
// one line per country. When the host puts a country on stage, the bot
// drops that country's line into chat. Autosaves on idle so the host
// never has to think about a Save button.
export function AdminCommentator({ initial }: { initial: Record<string, string> }) {
  const [lines, setLines] = useState<Record<string, string>>(initial);
  const [status, setStatus] = useState<"idle" | "dirty" | "saving" | "saved">("idle");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const linesRef = useRef(lines);
  linesRef.current = lines;
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const set = (k: string, v: string) => {
    setLines((p) => ({ ...p, [k]: v }));
    setStatus("dirty");
  };

  const flush = async () => {
    setStatus("saving");
    try {
      const res = await fetch("/api/admin/commentator", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lines: linesRef.current }),
      });
      if (!res.ok) throw new Error("save failed");
      setStatus("saved");
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setStatus("idle"), 1400);
    } catch {
      setStatus("dirty");
      toast.error("Save failed (network).");
    }
  };

  useEffect(() => {
    if (status !== "dirty") return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void flush(); }, AUTOSAVE_DELAY);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, status]);

  const uploadPhoto = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body: form });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (res.ok && data.url) {
        set(PHOTO_KEY, data.url);
      } else {
        toast.error(data.error ?? "Upload failed.");
      }
    } catch {
      toast.error("Upload failed (network).");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <AdminPageTitle
        subtitle="One line per finalist. Drops into chat when the country takes the stage."
        trailing={<SaveStatus status={status} />}
      >
        Banter
      </AdminPageTitle>
      <section className="glass-card rounded-2xl p-5 sm:p-6 flex flex-col gap-5">
        {/* Photo on the left, upload + name fields stacked on the
            right, so the row reads as a single identity card. */}
        <div className="flex items-start gap-4">
          <span className="relative grid h-32 w-32 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white/[0.06] ring-1 ring-white/12 text-white/40">
            {lines[PHOTO_KEY] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={lines[PHOTO_KEY]} alt="" className="h-full w-full object-cover" />
            ) : (
              <FluentEmoji glyph="🎙️" size={56} />
            )}
            {lines[PHOTO_KEY] && (
              <button
                type="button"
                onClick={() => set(PHOTO_KEY, "")}
                aria-label="Remove photo"
                className="absolute top-1.5 right-1.5 h-6 w-6 grid place-items-center rounded-full bg-black/70 text-white/80 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </span>

          <div className="flex-1 min-w-0 flex flex-col gap-3">
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
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="self-start"
            >
              <ImagePlus className="h-4 w-4 mr-1.5" />
              {uploading ? "Uploading…" : lines[PHOTO_KEY] ? "Replace photo" : "Upload photo"}
            </Button>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs uppercase tracking-wider text-white/45 font-display">Name</span>
              <Input
                value={lines[NAME_KEY] ?? ""}
                onChange={(e) => set(NAME_KEY, e.target.value)}
                className="h-10"
              />
            </label>
          </div>
        </div>
      </section>

      <section className="glass-card rounded-2xl p-5 sm:p-6 flex flex-col gap-3">
        {countries.map((c) => (
          <label key={c.code} className="flex items-start gap-2.5">
            <span className="w-6 shrink-0 pt-2 text-center text-[11px] text-white/40 tabular-nums">{c.order}</span>
            <span className="w-28 sm:w-40 shrink-0 truncate pt-2 text-sm text-white/70">
              {c.flag} {c.name}
            </span>
            <AutogrowTextarea
              value={lines[c.code] ?? ""}
              onChange={(v) => set(c.code, v)}
            />
          </label>
        ))}
      </section>
    </div>
  );
}

// Autogrow textarea: starts at min 2 rows, expands as content fills.
// Resets back to single-row when emptied. Uses the natural scroll
// height of a mirror div instead of a measured-then-set-height
// dance because lines are short enough that recomputing on each
// keystroke is fine.
function AutogrowTextarea({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={2}
      className="flex-1 min-w-0 rounded-lg bg-black/30 border border-white/15 px-3 py-2
                 text-sm leading-snug text-white resize-none overflow-hidden
                 focus:border-flamingo focus:outline-none focus:ring-2 focus:ring-flamingo/40 transition"
    />
  );
}

function SaveStatus({ status }: { status: "idle" | "dirty" | "saving" | "saved" }) {
  if (status === "saving") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-white/55">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Saving…
      </span>
    );
  }
  if (status === "saved") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-success">
        <Check className="h-3.5 w-3.5" />
        Saved
      </span>
    );
  }
  if (status === "dirty") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-white/45">
        <span className="h-1.5 w-1.5 rounded-full bg-flamingo" />
        Unsaved
      </span>
    );
  }
  return <span className="text-xs text-white/35">Autosaves</span>;
}
