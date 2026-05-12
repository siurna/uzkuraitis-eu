"use client";

import { useEffect, useState } from "react";
import { Share2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRoomLive } from "@/components/room-shell";
import { shareTopTen } from "@/lib/share-card";
import { useLang, t } from "@/lib/i18n";

// Quiet share row on the Home tab — only renders after the voter has
// submitted a ballot (voterId stored in localStorage by vote-form).
// Fetches the rendered TOP10 PNG and hands it to the native share sheet
// (mobile) or copies it to the clipboard (desktop).
export function SharePicks() {
  const { code } = useRoomLive();
  const lang = useLang();
  const [voterId, setVoterId] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    setVoterId(localStorage.getItem(`uzk_voter_${code}`));
  }, [code]);

  if (!voterId) return null;

  const share = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const result = await shareTopTen({
        roomCode: code,
        voterId,
        caption: t(lang, "share_picks_caption"),
      });
      if (result === "clipboard") toast.success(t(lang, "share_image_copied"));
    } catch {
      toast.error(t(lang, "share_failed"));
    } finally {
      setSharing(false);
    }
  };

  return (
    <button
      type="button"
      onClick={share}
      disabled={sharing}
      className="flex items-center gap-2.5 rounded-2xl px-4 py-3
                 bg-white/[0.04] ring-1 ring-white/8 hover:bg-white/[0.07]
                 transition transform-gpu duration-150 active:scale-[0.99]
                 disabled:opacity-60 text-sm self-start"
    >
      {sharing ? (
        <Loader2 className="h-4 w-4 animate-spin text-white/70" />
      ) : (
        <Share2 className="h-4 w-4 text-white/70" />
      )}
      <span>{sharing ? t(lang, "share_preparing") : t(lang, "share_picks")}</span>
    </button>
  );
}
