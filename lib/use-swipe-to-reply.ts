"use client";

import { useRef, type PointerEvent as ReactPointerEvent } from "react";

// Hand-rolled horizontal swipe-to-reply for a chat bubble.
//
// The bubble follows the finger in the reply direction only, capped at
// SWIPE_CAP with a soft rubber-band past it. Releasing past
// SWIPE_COMMIT fires the reply. The first few pixels of travel are used
// to decide horizontal-swipe vs. vertical-scroll and the choice is
// locked, so the list still scrolls smoothly and the bubble never
// jitters when you only meant to scroll past it.
//
// All movement is written to the DOM directly — no React re-renders per
// pointermove. The bubble itself uses `touch-action: pan-y` so the
// browser doesn't claim horizontal pans before we can.
const SWIPE_CAP = 64;
const SWIPE_COMMIT = 40;

export function useSwipeToReply({
  dir,
  onCommit,
  onLock,
}: {
  /** +1 = incoming message (swipe right), -1 = own message (swipe left). */
  dir: 1 | -1;
  onCommit: () => void;
  /** Fires once the gesture is recognised as a horizontal swipe. */
  onLock: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const arrowRef = useRef<HTMLSpanElement>(null);
  const swipedRef = useRef(false);
  const st = useRef<{
    id: number;
    x0: number;
    y0: number;
    v: number;
    axis: "" | "h" | "v";
  } | null>(null);

  const paint = (v: number) => {
    const el = ref.current;
    if (el) {
      el.style.transition = "none";
      el.style.transform = v === 0 ? "" : `translate3d(${v}px,0,0)`;
    }
    const a = arrowRef.current;
    if (a) a.style.opacity = String(Math.min(1, Math.abs(v) / SWIPE_COMMIT));
  };
  const release = (commit: boolean) => {
    const el = ref.current;
    if (el) {
      el.style.transition = "transform 240ms cubic-bezier(0.22,1,0.36,1)";
      el.style.transform = "";
      window.setTimeout(() => {
        if (el) el.style.transition = "";
      }, 280);
    }
    const a = arrowRef.current;
    if (a) {
      a.style.transition = "opacity 220ms";
      a.style.opacity = "0";
    }
    if (commit) onCommit();
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.button > 0) return;
    swipedRef.current = false;
    st.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, v: 0, axis: "" };
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const s = st.current;
    if (!s || e.pointerId !== s.id) return;
    const dx = e.clientX - s.x0;
    const dy = e.clientY - s.y0;
    if (s.axis === "") {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      s.axis = Math.abs(dx) > Math.abs(dy) + 2 ? "h" : "v";
      if (s.axis === "h") {
        swipedRef.current = true;
        onLock();
        try {
          ref.current?.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      }
    }
    if (s.axis !== "h") return;
    let v = dir === 1 ? Math.max(0, dx) : Math.min(0, dx);
    if (Math.abs(v) > SWIPE_CAP) v = dir * (SWIPE_CAP + (Math.abs(v) - SWIPE_CAP) * 0.18);
    s.v = v;
    paint(v);
  };
  const onPointerUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const s = st.current;
    if (!s || e.pointerId !== s.id) return;
    st.current = null;
    if (s.axis === "h") release(Math.abs(s.v) >= SWIPE_COMMIT);
  };

  return {
    ref,
    arrowRef,
    swipedRef,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
    },
  };
}
