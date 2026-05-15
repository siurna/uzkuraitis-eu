"use client";

import { useEffect, useState } from "react";

// True when the app is running as an installed PWA on iOS (Add to
// Home Screen / iPad standalone). Used for chrome that should match
// iOS's native screen-corner curvature — most notably the
// BottomSheet, which rounds its bottom-left/right to 40px in iOS
// PWA mode so the sheet's bottom edge hugs the screen's rounded
// corners instead of sitting in a flat-corner mismatch.
//
// Not the same as plain "standalone" (Android PWAs match via
// `display-mode: standalone` too, but Android phones don't all have
// the same rounded screen corners, and adding the 40px there reads
// as a floating-tile look that doesn't fit). Explicit iOS check on
// the UA gates it.
export function useIsIOSPwa(): boolean {
  const [is, setIs] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const ua = window.navigator.userAgent;
    const iOS = /iPad|iPhone|iPod/.test(ua);
    // Two-way standalone detection: matchMedia for modern iOS Safari
    // (16+) which adopts the standard `display-mode: standalone`,
    // navigator.standalone for older iOS versions that only carry
    // the proprietary flag. Either is sufficient.
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone ===
        true;
    setIs(iOS && standalone);
  }, []);
  return is;
}
