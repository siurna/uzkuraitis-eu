"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Copy, Check, RotateCw, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

// Per-room admin URL section + regenerate-join-code button. Lives on the
// global admin's per-room page (/admin/rooms/[code]) so the meta-admin
// can copy the host's manage URL or roll the join code if it leaks.
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
    <section className="glass-card rounded-xl p-5 flex flex-col gap-4">
      <header className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-flamingo/15 ring-1 ring-flamingo/30 text-flamingo">
          <LinkIcon className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-display text-xl leading-tight">Links</h2>
          <p className="text-xs text-white/45 mt-0.5">Copy URLs the host + voters need.</p>
        </div>
      </header>

      <div className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-widest text-white/50">
          Per-room admin (host)
        </p>
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
        <p className="text-[11px] text-white/40">
          Share with whoever runs the watch-along. Two toggles: voting open
          + tally bets. No global passkey needed.
        </p>
      </div>

      <div className="flex flex-col gap-2 pt-3 border-t border-white/5">
        <p className="text-xs uppercase tracking-widest text-white/50">
          Join link (for voters)
        </p>
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
        <p className="text-[11px] text-white/40">
          The 6-character code voters type at /. Click the rotate icon to
          regenerate; old code stops working immediately.
        </p>
      </div>
    </section>
  );
}
