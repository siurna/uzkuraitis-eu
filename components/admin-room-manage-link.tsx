"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Copy, Check, RotateCw, Link as LinkIcon, QrCode } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

// Two tile-shaped rows that share their look with the behaviour
// toggles + the identity rows: host link to copy + voter join link
// to copy / regenerate. Lives under the Operations section header
// on the room detail page (no per-card "Links" h2 of its own — the
// section header on the page does that work).
export function AdminRoomManageLink({
  code,
  adminToken,
}: {
  code: string;
  adminToken: string;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState<"manage" | "join" | null>(null);
  const [pending, start] = useTransition();
  const [origin, setOrigin] = useState("");

  useEffect(() => setOrigin(window.location.origin), []);

  const manageUrl = origin
    ? `${origin}/r/${code}/manage?key=${adminToken}`
    : `/r/${code}/manage?key=${adminToken}`;
  const joinUrl = origin ? `${origin}/?room=${code}` : `/?room=${code}`;

  const copy = async (kind: "manage" | "join", text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(kind);
    toast.success("Link copied");
    setTimeout(() => setCopied(null), 1500);
  };

  const regen = () => {
    if (
      !window.confirm(
        "Regenerate the join code? The current code stops working immediately and any pre-shared links will 404.",
      )
    ) {
      return;
    }
    start(async () => {
      const res = await fetch(`/api/admin/rooms/${code}/regen-code`, {
        method: "POST",
      });
      if (!res.ok) {
        toast.error("Couldn't regenerate.");
        return;
      }
      const { code: next } = (await res.json()) as { code: string };
      toast.success(`New code: ${next}`);
      router.replace(`/admin/rooms/${next}`);
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Host magic link. Tile shape mirrors the rename + code rows
          and the behaviour toggles — the URL preview lives in the
          body, the copy action sits on the right. */}
      <div className="rounded-2xl glass-surface px-4 py-3 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <span className="shrink-0 grid place-items-center h-10 w-10 rounded-xl bg-white/[0.06] ring-1 ring-white/12 text-white/65">
            <LinkIcon className="h-5 w-5" />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block font-display text-base">Host link</span>
            <span className="block text-xs text-white/50 leading-snug text-balance">
              The magic link the host runs the room from. Two toggles, no passkey.
            </span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <code className="flex-1 truncate text-xs bg-black/30 rounded-md px-3 py-2 font-mono">
            {manageUrl}
          </code>
          <Button
            size="sm"
            variant="outline"
            onClick={() => copy("manage", manageUrl)}
          >
            {copied === "manage" ? (
              <>
                <Check className="h-4 w-4 mr-1.5" /> Copied
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-1.5" /> Copy
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Voter join link. Same shape; the regen button is the only
          extra control. */}
      <div className="rounded-2xl glass-surface px-4 py-3 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <span className="shrink-0 grid place-items-center h-10 w-10 rounded-xl bg-white/[0.06] ring-1 ring-white/12 text-white/65">
            <QrCode className="h-5 w-5" />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block font-display text-base">Join link</span>
            <span className="block text-xs text-white/50 leading-snug text-balance">
              Share with voters. Regen rotates the 6-char code — old links 404.
            </span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <code className="flex-1 truncate text-xs bg-black/30 rounded-md px-3 py-2 font-mono">
            {joinUrl}
          </code>
          <Button
            size="sm"
            variant="outline"
            onClick={() => copy("join", joinUrl)}
          >
            {copied === "join" ? (
              <>
                <Check className="h-4 w-4 mr-1.5" /> Copied
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-1.5" /> Copy
              </>
            )}
          </Button>
          <motion.span whileTap={{ rotate: 360 }} transition={{ duration: 0.6 }}>
            <Button
              size="sm"
              variant="outline"
              onClick={regen}
              disabled={pending}
              className="border-error/40 text-error hover:bg-error/10"
              title="Regenerate join code"
            >
              <RotateCw className="h-4 w-4" />
            </Button>
          </motion.span>
        </div>
      </div>
    </div>
  );
}
