"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Check, RotateCw, Share2, QrCode } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

// Single-tile room link, shown inside the per-room admin settings
// tab. Used to also expose the host magic-link here, but that surface
// is now reserved for what the host actually hands out: the public
// room URL. "Share" instead of "Copy" — native share sheet when the
// platform supports it, clipboard fallback otherwise.
//
// `adminToken` prop is still accepted (the admin already has the
// magic link via their own session; we just don't show it inline
// here anymore).
export function AdminRoomManageLink({
  code,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  adminToken,
}: {
  code: string;
  adminToken: string;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const [origin, setOrigin] = useState("");

  useEffect(() => setOrigin(window.location.origin), []);

  const roomUrl = origin ? `${origin}/?room=${code}` : `/?room=${code}`;

  const share = async () => {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title: `Join ${code}`, url: roomUrl });
        return;
      } catch {
        /* user dismissed */
      }
    }
    try {
      await navigator.clipboard.writeText(roomUrl);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy.");
    }
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
    <div className="rounded-2xl glass-surface px-4 py-3 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="shrink-0 grid place-items-center h-10 w-10 rounded-xl bg-white/[0.06] ring-1 ring-white/12 text-white/65">
          <QrCode className="h-5 w-5" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block font-display text-base">Room link</span>
          <span className="block text-xs text-white/50 leading-snug text-balance">
            Share this with voters. Regen rotates the 6-char code — old
            links 404.
          </span>
        </span>
      </div>
      <div className="flex items-center gap-2">
        <code className="flex-1 truncate text-xs bg-black/30 rounded-md px-3 py-2 font-mono">
          {roomUrl}
        </code>
        <Button size="sm" variant="outline" onClick={share}>
          {copied ? (
            <>
              <Check className="h-4 w-4 mr-1.5" /> Copied
            </>
          ) : (
            <>
              <Share2 className="h-4 w-4 mr-1.5" /> Share
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
  );
}
