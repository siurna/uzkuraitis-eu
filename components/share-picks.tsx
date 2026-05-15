"use client";

import { useEffect, useState } from "react";
import { Share2, Loader2 } from "lucide-react";
import { useRoomLive } from "@/components/room-shell";
import { shareTopTen } from "@/lib/share-card";
import { t } from "@/lib/i18n";
import { useLang } from "@/lib/i18n-client";

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
  const ogUrl = `/api/og/${code}/${voterId}?lang=${lang}`;

  const share = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      await shareTopTen({
        roomCode: code,
        voterId,
        caption: t(lang, "share_picks_caption"),
        lang,
      });
    } catch {
      /* native share cancelled or clipboard refused — silent */
    } finally {
      setSharing(false);
    }
  };

  // Self-contained container so the home stack's gap-3 collapses cleanly
  // when this component returns null (no voter yet) — no phantom wrapper.
  return (
    // Matches the other home widgets' container (max-w-3xl px-4) so
    // the widget stack reads as one consistent column instead of one
    // edge-to-edge bleed-through breaking the rhythm. Vote-form mounts
    // this same component too — that page already has its own
    // max-w-3xl wrapper, so the double-wrap is harmless.
    <div className="container mx-auto max-w-3xl px-4">
    <button
      type="button"
      onClick={share}
      disabled={sharing}
      className="relative block w-full overflow-hidden rounded-3xl text-left disabled:opacity-60"
      style={{ background: "linear-gradient(135deg, #ff3ede 0%, #c41475 50%, #6020c6 100%)" }}
    >
      {/* the rendered TOP10 card, tilted, bleeding off the right edge */}
      <div className="pointer-events-none absolute -right-4 top-1/2 -translate-y-1/2 h-[7.5rem] w-[5.625rem] rotate-[8deg] overflow-hidden rounded-xl ring-1 ring-white/25 bg-black/30 shadow-xl">
        {thumbOk ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ogUrl} alt="" className="h-full w-full object-cover" onError={() => setThumbOk(false)} />
        ) : (
          <span className="grid h-full w-full place-items-center"><Share2 className="h-6 w-6 text-white/80" /></span>
        )}
        {sharing && (
          <span className="absolute inset-0 grid place-items-center bg-black/55">
            <Loader2 className="h-5 w-5 animate-spin text-white" />
          </span>
        )}
      </div>
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "linear-gradient(95deg, rgba(8,9,28,0.42) 0%, rgba(8,9,28,0.15) 42%, transparent 64%)" }}
      />
      <div className="relative flex items-center gap-3 px-5 py-5 min-h-[7rem]">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/75 font-display leading-tight mb-1">{t(lang, "share_eyebrow")}</p>
          <p className="font-display text-xl text-white leading-tight drop-shadow-sm text-balance">{sharing ? t(lang, "share_preparing") : t(lang, "share_picks")}</p>
          <p className="text-sm text-white/70 leading-snug mt-0.5 pr-24 text-balance">{t(lang, "share_picks_sub")}</p>
        </div>
      </div>
    </button>
    </div>
  );
}
