"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Share2, Users } from "lucide-react";
import { useOthers, useSelf } from "@/lib/liveblocks";
import { Button } from "@/components/ui/button";
import { Flag } from "@/components/flag";
import { getAvatar } from "@/lib/avatars";
import { toast } from "sonner";

export function PresenceBar({ code, name }: { code: string; name: string }) {
  const others = useOthers();
  const self = useSelf();
  const [copied, setCopied] = useState(false);

  const total = others.length + (self ? 1 : 0);

  const share = async () => {
    const url = `${window.location.origin}/?room=${code}`;
    const payload = {
      title: `${name}, Eurovision 2026`,
      text: `Join my Eurovision room, code ${code}`,
      url,
    };
    if (navigator.share) {
      try {
        await navigator.share(payload);
        return;
      } catch {
        /* user cancelled, fall through to clipboard */
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Link copied!");
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <header className="sticky top-0 z-30 backdrop-blur-md bg-dark-blue-900/70 border-b border-white/5">
      <div className="container mx-auto max-w-3xl px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <p className="font-display text-lg truncate">{name}</p>
            <code className="text-xs font-mono uppercase tracking-[0.3em] text-flamingo">
              {code}
            </code>
          </div>
        </div>

        <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-white/5 text-xs">
          <Users className="h-3 w-3 text-turquoise" />
          <span className="text-white/80 tabular-nums">{total}</span>
        </div>

        <Button
          size="sm"
          variant="ghost"
          onClick={share}
          aria-label="Share room link"
          className="rounded-full"
        >
          <Share2 className="h-4 w-4" />
        </Button>
      </div>

      {others.length > 0 && (
        <div className="container mx-auto max-w-3xl px-4 pb-3 flex items-center gap-2 overflow-x-auto">
          <AnimatePresence initial={false} mode="popLayout">
            {[self, ...others].filter(Boolean).map((u) => {
              const info = u!.info;
              // Presence-set name overrides the auth-time userInfo name so
              // the chip updates live the moment someone hits "Join the
              // party" without a reconnect.
              const liveName = u!.presence?.name ?? info?.name ?? "Guest";
              const initial =
                liveName.trim().charAt(0).toUpperCase() || "?";
              const avatarId = u!.presence?.avatar ?? null;
              const avatar = getAvatar(avatarId);
              return (
                <motion.div
                  key={u!.connectionId}
                  layout
                  initial={{ opacity: 0, scale: 0.4 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.4 }}
                  transition={{ type: "spring", stiffness: 380, damping: 22 }}
                  className="flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full bg-white/5 text-xs whitespace-nowrap"
                  title={
                    avatar
                      ? `${liveName} · ${avatar.artist} (${avatar.country.toUpperCase()} ${avatar.year})`
                      : liveName
                  }
                >
                  {avatar ? (
                    <Flag
                      code={avatar.country}
                      size="sm"
                      className="h-5 w-5 rounded-full ring-1 ring-white/20 object-cover"
                    />
                  ) : (
                    <span
                      className="h-5 w-5 rounded-full flex items-center justify-center text-[11px] font-semibold"
                      style={{ background: info?.color ?? "#7ce0d8" }}
                    >
                      {initial}
                    </span>
                  )}
                  <span className="text-white/70 max-w-24 truncate">
                    {liveName}
                  </span>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      <span aria-live="polite" className="sr-only">
        {copied ? "Link copied" : ""}
      </span>
    </header>
  );
}
