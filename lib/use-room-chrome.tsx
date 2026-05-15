"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
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
// Two state inputs converge into one `hidden` boolean:
//
//   1. `composerActive` — flipped by the chat composer's onFocus /
//      onBlur via `useRoomChrome().setComposerActive(...)`. The
//      cleanest, explicit signal: "the chat composer has the
//      keyboard up; clear the dock".
//
//   2. `keyboardUp` — visualViewport heuristic that derives "is a
//      keyboard up" from the height delta between window.innerHeight
//      and visualViewport.height. Acts as a safety net in case the
//      onFocus event ever fails to fire (input mounted late, focus
//      landed on a child, iOS re-mount quirk). It triggers IN
//      ADDITION to the explicit signal, never INSTEAD of it.
//
// Either signal alone hides the chrome. Both clearing brings it
// back. The header / dock components apply `max-md:hidden` to
// themselves when `hidden` is true so the rule only fires on mobile —
// desktop keeps the chrome regardless.
//
// Why a context instead of custom DOM events (the previous design):
// events can be missed (timing, listener teardown order, dispatch
// before mount). A useState + Provider is the canonical React way
// to share boolean state across a tree, and the value flows through
// React's reconciliation so consumers always see the current value.

type RoomChromeAPI = {
  /** True when the chrome (header + dock) should be hidden on mobile. */
  hidden: boolean;
  /** Imperative: the chat composer (or any other input that owns the
   *  keyboard moment) tells us when it has focus. */
  setComposerActive: (active: boolean) => void;
};

const RoomChromeContext = createContext<RoomChromeAPI | null>(null);

const KEYBOARD_DELTA_PX = 120;

export function RoomChromeProvider({ children }: { children: ReactNode }) {
  const [composerActive, setComposerActive] = useState(false);
  const [keyboardUp, setKeyboardUp] = useState(false);

  // visualViewport-based keyboard heuristic. Fires whenever the
  // visual viewport resizes (keyboard slide, URL bar collapse, screen
  // rotation). 120px delta is comfortably above any browser-chrome
  // shrink and well below any iPhone keyboard size — a clean threshold.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => {
      setKeyboardUp(window.innerHeight - vv.height > KEYBOARD_DELTA_PX);
    };
    onResize();
    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
  }, []);

  const value = useMemo<RoomChromeAPI>(
    () => ({
      hidden: composerActive || keyboardUp,
      setComposerActive,
    }),
    [composerActive, keyboardUp],
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
