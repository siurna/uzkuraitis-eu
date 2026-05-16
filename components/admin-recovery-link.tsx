"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Link as LinkIcon, Check } from "lucide-react";

// Admin "Recovery link" affordance. Mints a private one-time URL the
// admin can DM to a participant who lost their PWA / cleared storage;
// the participant opens it and the server re-mints their signed
// session cookie + writes sessionId / name / avatar back to
// localStorage, dropping them straight into the room with their
// original identity (ballot, bets, score row all attached).
//
// Tokens are 24h-valid HMAC-signed. The link is shown inline AND
// copied to clipboard on tap so the admin can hand it off through
// whatever channel they prefer.
export function AdminRecoveryLink({
  code,
  sessionId,
}: {
  code: string;
  sessionId: string;
}) {
  const [pending, start] = useTransition();
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const mint = () => {
    start(async () => {
      try {
        const res = await fetch(
          `/api/admin/rooms/${code}/voters/${sessionId}/recovery-link`,
          { method: "POST" },
        );
        const data = (await res.json().catch(() => null)) as
          | { path?: string; error?: string }
          | null;
        if (!res.ok || !data?.path) {
          toast.error(data?.error ?? "Couldn't mint link.");
          return;
        }
        const full = `${window.location.origin}${data.path}`;
        setUrl(full);
        try {
          await navigator.clipboard.writeText(full);
          setCopied(true);
          toast.success("Recovery link copied.");
          window.setTimeout(() => setCopied(false), 2500);
        } catch {
          toast.message("Link ready — tap the field to copy.");
        }
      } catch {
        toast.error("Network error.");
      }
    });
  };

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={mint}
        disabled={pending}
        className="inline-flex items-center gap-1.5 self-start rounded-full px-3 h-7
                   text-[11px] font-display
                   bg-white/[0.04] ring-1 ring-white/12 text-white/75
                   hover:bg-white/[0.08] disabled:opacity-50 transition"
      >
        {pending ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : copied ? (
          <Check className="h-3 w-3 text-emerald-300" />
        ) : (
          <LinkIcon className="h-3 w-3" />
        )}
        {url ? "Re-mint link" : "Recovery link"}
      </button>
      {url && (
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(url).then(
              () => {
                setCopied(true);
                toast.success("Link copied.");
                window.setTimeout(() => setCopied(false), 2500);
              },
              () => toast.error("Copy failed."),
            );
          }}
          className="font-mono text-[10px] text-white/55 text-left break-all
                     bg-black/30 ring-1 ring-white/8 rounded-lg px-2 py-1.5
                     hover:bg-black/40 transition"
          title="Tap to copy"
        >
          {url}
        </button>
      )}
    </div>
  );
}
