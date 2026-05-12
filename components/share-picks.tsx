"use client";

import { useEffect, useState } from "react";
import { Share2, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useRoomLive } from "@/components/room-shell";
import { shareTopTen } from "@/lib/share-card";
import { useLang, t } from "@/lib/i18n";

// Quiet share row on the Home tab — only renders after the voter has
// submitted a ballot (voterId stored in localStorage by vote-form). Shows
// a live thumbnail of the rendered TOP10 card (which also warms the
// browser cache, so the share/copy below is instant), and on tap hands
// the PNG to the native share sheet (mobile) / clipboard (desktop).
export function SharePicks() {
  const { code } = useRoomLive();
  const lang = useLang();
  const [voterId, setVoterId] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [thumbOk, setThumbOk] = useState(true);

  useEffect(() => {
    setVoterId(localStorage.getItem(`uzk_voter_${code}`));
  }, [code]);

  if (!voterId) return null;
  const ogUrl = `/api/og/${code}/${voterId}`;

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
      className="w-full text-left rainbow-border rounded-3xl block transform-gpu transition duration-150 active:scale-[0.99] disabled:opacity-60"
    >
      <div className="relative overflow-hidden rounded-[22px] bg-dark-blue-900/85 px-4 py-4 flex items-center gap-4">
        <div className="absolute inset-0 pointer-events-none"
             style={{ background: "linear-gradient(120deg, rgba(255,46,222,0.18), rgba(255,46,222,0.06) 50%, transparent)" }} />
        <span className="relative shrink-0 grid place-items-center h-16 w-12 rounded-lg overflow-hidden ring-1 ring-white/15 bg-black/30">
          {thumbOk ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ogUrl} alt="" className="h-full w-full object-cover" onError={() => setThumbOk(false)} />
          ) : (
            <Share2 className="h-5 w-5 text-white/80" />
          )}
          {sharing && (
            <span className="absolute inset-0 grid place-items-center bg-black/55">
              <Loader2 className="h-5 w-5 animate-spin text-white" />
            </span>
          )}
        </span>
        <div className="relative min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-[0.32em] text-flamingo font-display leading-tight mb-0.5">{t(lang, "share_eyebrow")}</p>
          <p className="font-display text-lg text-white leading-tight">{sharing ? t(lang, "share_preparing") : t(lang, "share_picks")}</p>
          <p className="text-sm text-white/55 leading-snug mt-0.5">{t(lang, "share_picks_sub")}</p>
        </div>
        <ArrowRight className="relative h-5 w-5 text-dark-blue-300 shrink-0" />
      </div>
    </button>
  );
}
