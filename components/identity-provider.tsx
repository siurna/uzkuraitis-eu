"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  bootstrapIdentity,
  type ResolvedIdentity,
} from "@/lib/identity-bootstrap";

// IdentityProvider runs the cookie-first bootstrap exactly once per
// page load, before any descendant renders. While the bootstrap is in
// flight (one HTTP roundtrip to /api/identity, capped at 3s), we
// render a minimal loader. The blocking ensures that NO downstream
// code — chat, votes, reactions, room shell, anything that reads
// `localStorage.uzk_session` — can run with a half-resolved sid.
//
// After the bootstrap completes:
//   - `sessionId` is guaranteed non-empty
//   - the signed cookie matches the sessionId (or is being retried
//     in the background — guardSession-protected writes will retry
//     naturally if they hit a window where the cookie hasn't landed)
//   - localStorage is reconciled if it was empty / mismatched
//
// Why a Context if everything is also available via getSessionId()
// from the module? Because (a) React components shouldn't be reading
// from a module-level cache without a re-render trigger, and (b)
// updates to name/avatar from the name gate need to propagate to
// consumers — useIdentity() with a context is the established
// React way.

type IdentityState =
  | { kind: "loading" }
  | { kind: "ready"; identity: ResolvedIdentity }
  | { kind: "fatal" };

const IdentityContext = createContext<ResolvedIdentity | null>(null);

export function useResolvedIdentity(): ResolvedIdentity {
  const ctx = useContext(IdentityContext);
  if (!ctx) {
    throw new Error(
      "useResolvedIdentity called outside <IdentityProvider> — wrap the tree at app/layout.tsx",
    );
  }
  return ctx;
}

export function IdentityProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<IdentityState>({ kind: "loading" });

  useEffect(() => {
    let alive = true;
    bootstrapIdentity()
      .then((identity) => {
        if (alive) setState({ kind: "ready", identity });
      })
      .catch(() => {
        // Should never happen — bootstrap swallows all errors and
        // falls back to a fresh mint. Keep the branch so a future
        // refactor that adds throwing paths is loud.
        if (alive) setState({ kind: "fatal" });
      });
    return () => {
      alive = false;
    };
  }, []);

  if (state.kind === "loading") {
    return <IdentityLoader />;
  }
  if (state.kind === "fatal") {
    return (
      <main className="min-h-dvh flex flex-col items-center justify-center px-6 text-center gap-3">
        <p className="font-display text-lg text-white">Nepavyko įkrauti.</p>
        <p className="text-sm text-white/60 max-w-sm">
          Pabandyk perkrauti puslapį.
        </p>
      </main>
    );
  }
  return (
    <IdentityContext.Provider value={state.identity}>
      {children}
    </IdentityContext.Provider>
  );
}

// Tiny loader — the brand heart pulse, on a transparent backdrop so
// it sits inside the page bloom rather than as a separate frame.
// Sub-300ms in the happy case; sub-3s worst case (bootstrap timeout).
function IdentityLoader() {
  return (
    <main className="min-h-dvh flex items-center justify-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/70-heart.webp"
        alt=""
        aria-hidden
        className="h-20 w-20 object-contain opacity-80 heartbeat-loop"
      />
    </main>
  );
}
