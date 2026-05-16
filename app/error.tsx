"use client";

import { useEffect } from "react";

// Root error boundary. Any unhandled throw inside the App-Router tree
// lands here instead of Next's bare framework error UI. The show is
// live, so the recovery message stays in brand language (LT default
// is `lt`, but we don't have access to the room's selected language
// at this scope — and the boundary needs to render before i18n is
// loaded anyway, so the copy below stays plain-bilingual).
//
// `reset()` lets Next attempt to re-render the failing subtree
// without a full nav. If the throw is in render of a stable widget,
// reset usually clears. If it's transient (network blip), the next
// re-render after the user taps Reload almost always succeeds.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Production logs already capture this via Vercel/Next; we log to
    // the browser console too so a host watching DevTools mid-show
    // gets a fingerprint without having to dig through the platform.
    // eslint-disable-next-line no-console
    console.error("[app/error]", error);
  }, [error]);

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 text-center gap-4">
      <h1 className="font-display text-2xl text-white">Ups, kažkas lūžo.</h1>
      <p className="text-sm text-white/70 max-w-sm">
        Something just broke. Pabandyk perkrauti puslapį. If it keeps
        happening, swipe-kill the app and re-open.
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="rainbow-border rounded-2xl mt-2"
      >
        <span className="block px-5 py-2.5 rounded-[14px] bg-white text-dark-blue font-display">
          Reload / Perkrauti
        </span>
      </button>
      {error.digest && (
        <p className="text-[10px] text-white/30 tracking-wider mt-3 font-mono">
          {error.digest}
        </p>
      )}
    </div>
  );
}
