"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

// Room chrome = the fixed header (PresenceBar) + the fixed bottom dock
// (RoomTabBar). They live in their own positioning layers (each is
// `position: fixed`), so there's no layout overlap with the rest of
// the room content — but their VISIBILITY needs a single source of
// truth that any descendant can read and any caller can imperatively
// drive.
//
// Single state input: `composerActive`, flipped by the chat composer's
// onFocus / onBlur via `useRoomChrome().setComposerActive(...)`. The
// header / dock apply `max-md:hidden` when this is true so the rule
// only fires on mobile; desktop keeps the chrome regardless.
//
// (A visualViewport keyboard heuristic used to OR alongside this as a
// safety net, but it was the source of mid-typing chrome flickers as
// the iOS predictive-text strip toggled — the resize was crossing
// the threshold both ways within a single keystroke. The explicit
// onFocus / onBlur signal is reliable enough on its own; we'll add
// the heuristic back if a real "missed onFocus" bug surfaces.)

type RoomChromeAPI = {
  /** True when the chrome (header + dock) should be hidden on mobile. */
  hidden: boolean;
  /** Imperative: the chat composer (or any other input that owns the
   *  keyboard moment) tells us when it has focus. */
  setComposerActive: (active: boolean) => void;
};

const RoomChromeContext = createContext<RoomChromeAPI | null>(null);

export function RoomChromeProvider({ children }: { children: ReactNode }) {
  const [composerActive, setComposerActive] = useState(false);

  const value = useMemo<RoomChromeAPI>(
    () => ({
      hidden: composerActive,
      setComposerActive,
    }),
    [composerActive],
  );

  return (
    <RoomChromeContext.Provider value={value}>
      {children}
    </RoomChromeContext.Provider>
  );
}

/** Read the current chrome state. Returns `hidden: false` when no
 *  provider is in the tree (e.g. /admin pages); consumers can safely
 *  call this regardless of where they're mounted. */
export function useRoomChrome(): RoomChromeAPI {
  const ctx = useContext(RoomChromeContext);
  return (
    ctx ?? {
      hidden: false,
      setComposerActive: () => {},
    }
  );
}

/** Convenience for components that only need to declare "I'm the
 *  composer and I have focus right now". Wires onFocus/onBlur for
 *  you on any input via a stable handler pair. */
export function useChromeComposerFocus(): {
  onFocus: () => void;
  onBlur: () => void;
} {
  const { setComposerActive } = useRoomChrome();
  return {
    onFocus: useCallback(() => setComposerActive(true), [setComposerActive]),
    onBlur: useCallback(() => setComposerActive(false), [setComposerActive]),
  };
}
