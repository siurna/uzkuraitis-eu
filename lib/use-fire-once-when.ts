"use client";

import { useEffect, useRef } from "react";

// Generic "fire a side-effect ONCE for this key, but only once the
// `when` predicate is true". Solves the recurring problem of chat-
// broadcast animations (confetti, paparazzi flash, etc) that should
// play exactly once per (browser × message), and only at the right
// moment — not when the user is on the bingo tab while the
// broadcast happens to land.
//
// Storage: sessionStorage (per tab, survives across this session
// but cleared on PWA cold-start). Fine for one-shot animations
// where re-firing a day later is what the user wants.
//
// `when` is re-checked on every change; the first time it becomes
// true AND the key isn't already stamped, `onFire` runs and the
// stamp lands. Subsequent changes to `when` (or component re-mounts)
// see the stamp and bail.
export function useFireOnceWhen({
  storageKey,
  when,
  onFire,
}: {
  /** Unique stable key for sessionStorage. Typically built from
   *  a message id or a (room, country) pair so each instance has
   *  its own one-shot guard. */
  storageKey: string;
  /** Animation fires the first time this flips true. */
  when: boolean;
  /** The side-effect itself. Wrap any closures in useCallback or
   *  the hook will refire your latest closure when it changes. */
  onFire: () => void;
}) {
  // In-memory guard for the lifetime of THIS mount. Belt-and-braces
  // with sessionStorage: a strict-mode dev double-mount otherwise
  // races sessionStorage between the two invocations.
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    if (!when) return;
    try {
      if (sessionStorage.getItem(storageKey) === "1") return;
      sessionStorage.setItem(storageKey, "1");
    } catch {
      /* private mode — falls back to in-memory guard only */
    }
    firedRef.current = true;
    onFire();
  }, [when, storageKey, onFire]);
}
