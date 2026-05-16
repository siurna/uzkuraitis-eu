"use client";

import { useEffect } from "react";

// The dvh trap on iOS Safari (16.0-16.3, recurring in 18+):
// `100dvh` is supposed to track the dynamic viewport, but in practice
// WebKit doesn't reliably emit updates when the URL bar collapses,
// when the keyboard slides up/down via "Done", or when you swap PWA
// tabs. The reported height can be stuck up to ~80px past the real
// visible viewport, leaving fixed/sticky elements with gaps below
// them OR clipping CTAs behind the URL bar.
//
// We side-step the unit entirely. `window.innerHeight` IS accurate
// on iOS (it always reflects the layout viewport, fires `resize` +
// `orientationchange` reliably). Push it into a CSS custom property
// so any layout that needs "full visible viewport height" can
// reference `calc(var(--uzk-vh) * 100)` instead of `100dvh`.
//
// Mounted once at the app root (see app/layout.tsx). No props,
// renders nothing.
export function ViewportSync() {
  useEffect(() => {
    const sync = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty("--uzk-vh", `${vh}px`);
    };
    sync();
    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", sync);
    // visualViewport.resize fires for keyboard slides + URL-bar
    // collapses, which `resize` sometimes misses on iOS.
    const vv = window.visualViewport;
    vv?.addEventListener("resize", sync);
    return () => {
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
      vv?.removeEventListener("resize", sync);
    };
  }, []);
  return null;
}
