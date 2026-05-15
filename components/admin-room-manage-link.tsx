"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Check, Copy, KeyRound, RotateCw, Share2, QrCode } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

// TWO tiles inside the per-room admin settings tab:
//   1. Public room link (Share / native sheet → clipboard fallback) +
//      a destructive Regen control to rotate the 6-char code.
//   2. Host magic-link (Copy to clipboard) — the magic URL the host
//      runs the show from. Came back after one round where it was
//      removed in favour of just the public link; the admin needs
//      a way to re-share the magic link with a co-host without
//      digging into the DB.
export function AdminRoomManageLink({
  code,
  adminToken,
}: {
  code: string;
  adminToken: string;
}) {
  const router = useRouter();
  const [copiedRoom, setCopiedRoom] = useState(false);
  const [copiedHost, setCopiedHost] = useState(false);
  const [pending, start] = useTransition();
  const [origin, setOrigin] = useState("");

  useEffect(() => setOrigin(window.location.origin), []);

  const roomUrl = origin ? `${origin}/?room=${code}` : `/?room=${code}`;
  const hostUrl = origin
    ? `${origin}/host/${code}?key=${adminToken}`
    : `/host/${code}?key=${adminToken}`;

  const shareRoom = async () => {
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
      setCopiedRoom(true);
      toast.success("Link copied");
      setTimeout(() => setCopiedRoom(false), 1500);
    } catch {
      toast.error("Couldn't copy.");
    }
  };

  const copyHost = async () => {
    try {
      await navigator.clipboard.writeText(hostUrl);
      setCopiedHost(true);
      toast.success("Host link copied");
      setTimeout(() => setCopiedHost(false), 1500);
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
    <div className="flex flex-col gap-3">
      {/* Public room link — what voters tap to join. */}
      <div className="rounded-2xl glass-surface px-4 py-3 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <span className="shrink-0 grid place-items-center h-10 w-10 rounded-xl bg-white/[0.06] ring-1 ring-white/12 text-white/65">
            <QrCode className="h-5 w-5" />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block font-display text-base">Room link</span>
            <span className="block text-xs text-white/50 leading-snug text-balance">
              Share this with voters. Regen rotates the 6-char code, old
              links 404.
            </span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <code className="flex-1 truncate text-xs bg-black/30 rounded-md px-3 py-2 font-mono">
            {roomUrl}
          </code>
          <Button size="sm" variant="outline" onClick={shareRoom}>
            {copiedRoom ? (
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

      {/* Host magic-link — gates the /host/[code] surface where the
          host runs the show from (toggles + identity, no live panel
          since that's a global thing). Token in the URL is the only
          auth; rotating the join code doesn't touch the token.
          Same neutral icon tile as the room link above so the two
          tiles read as a pair — the flamingo accent was making the
          host link feel like an alert. */}
      <div className="rounded-2xl glass-surface px-4 py-3 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <span className="shrink-0 grid place-items-center h-10 w-10 rounded-xl bg-white/[0.06] ring-1 ring-white/12 text-white/65">
            <KeyRound className="h-5 w-5" />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block font-display text-base">Host link</span>
            <span className="block text-xs text-white/50 leading-snug text-balance">
              The magic URL the host runs this room from. Anyone with
              this link manages the room without a passkey, send it
              to a co-host carefully.
            </span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <code className="flex-1 truncate text-xs bg-black/30 rounded-md px-3 py-2 font-mono">
            {hostUrl}
          </code>
          <Button size="sm" variant="outline" onClick={copyHost}>
            {copiedHost ? (
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
    </div>
  );
}
