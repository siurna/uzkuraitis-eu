"use client";

import { useEffect, useState } from "react";
import { Share2, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { useRoomLive } from "@/components/room-shell";
import { useLang, t } from "@/lib/i18n";

// Quiet share row on the Home tab — only renders after the voter has
// submitted a ballot (voterId stored in localStorage by vote-form).
// Tapping calls navigator.share with the OG image URL; falls back to
// clipboard. The OG endpoint returns a 1200×630 PNG via Next's
// ImageResponse, suitable for any social preview.
export function SharePicks() {
  const { code } = useRoomLive();
  const lang = useLang();
  const [voterId, setVoterId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setVoterId(localStorage.getItem(`uzk_voter_${code}`));
  }, [code]);

  if (!voterId) return null;

  const shareUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/api/og/${code}/${voterId}`;

  const share = async () => {
    const text = t(lang, "share_picks_caption");
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title: text, text, url: shareUrl });
        return;
      } catch {
        /* user cancelled, fall through */
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success(t(lang, "link_copied"));
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error(t(lang, "couldnt_copy"));
    }
  };

  return (
    <button
      type="button"
      onClick={share}
      className="flex items-center gap-2.5 rounded-2xl px-4 py-3
                 bg-white/[0.04] ring-1 ring-white/8 hover:bg-white/[0.07]
                 transition text-sm self-start"
    >
      {copied ? (
        <Check className="h-4 w-4 text-success" />
      ) : (
        <Share2 className="h-4 w-4 text-white/70" />
      )}
      <span>{t(lang, "share_picks")}</span>
      <Copy className="h-3.5 w-3.5 text-white/35" />
    </button>
  );
}
