"use client";

import { useEffect, useRef } from "react";

// Cloudflare Turnstile widget — invisible mode. The script is lazy-
// loaded on first mount and a 0×0 widget is mounted that runs the
// challenge entirely in the background; the callback fires with a
// token once Cloudflare decides the visitor is fine, and the gate
// flips. No checkbox, no logo, no UX cost.
//
// Two things to know if this stops "just working":
//   1. Invisible mode REQUIRES the site key in the Cloudflare dashboard
//      to be configured as "Invisible". A "Managed" key will render the
//      visible widget here even though we asked for size:"invisible".
//   2. There's no host-side fallback if the visitor's browser blocks the
//      script (Brave aggressive shields, some Pi-hole configs). When
//      that happens the `onError` prop fires so the caller can surface
//      a retry chip instead of leaving the join button silently dead.

type TurnstileOptions = {
  sitekey: string;
  callback?: (token: string) => void;
  "error-callback"?: () => void;
  "expired-callback"?: () => void;
  theme?: "light" | "dark" | "auto";
  size?: "normal" | "flexible" | "compact" | "invisible";
};

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement | string, opts: TurnstileOptions) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId: string) => void;
    };
    onTurnstileReady?: () => void;
  }
}

const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export function TurnstileWidget({
  siteKey,
  onToken,
  onExpire,
  onError,
  /** Bump to force the widget to re-render (retry after a failure). */
  resetKey,
}: {
  siteKey: string;
  onToken: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
  resetKey?: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Inject the script if it isn't already loaded.
    if (!document.querySelector(`script[src^="${SCRIPT_SRC}"]`)) {
      const script = document.createElement("script");
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      // If the host blocks Cloudflare's script (Brave shields, Pi-hole,
      // strict uBlock filters) we still need a signal — the
      // `error-callback` only fires if the widget actually mounted.
      // Surface load failure as the same onError so the caller can
      // render its retry chip.
      script.onerror = () => onError?.();
      document.head.appendChild(script);
    }

    const render = () => {
      if (cancelled) return;
      if (!window.turnstile || !containerRef.current) return false;
      if (widgetIdRef.current) return true; // already rendered
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: (token) => onToken(token),
        "expired-callback": () => onExpire?.(),
        "error-callback": () => onError?.(),
        size: "invisible",
      });
      return true;
    };

    if (!render()) {
      // Script not loaded yet — poll briefly until the global appears.
      // If 8s pass without it landing, treat that as a load failure so
      // the caller can swap in a retry affordance.
      const interval = window.setInterval(() => {
        if (render()) window.clearInterval(interval);
      }, 100);
      const timeout = window.setTimeout(() => {
        window.clearInterval(interval);
        if (!widgetIdRef.current) onError?.();
      }, 8000);
      return () => {
        cancelled = true;
        window.clearInterval(interval);
        window.clearTimeout(timeout);
      };
    }

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          /* ignore — script may have torn down */
        }
        widgetIdRef.current = null;
      }
    };
    // siteKey + resetKey trigger re-mount; callbacks are read via the
    // refs the parent passes (stable since parents memoise setters).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey, resetKey]);

  // Invisible mode renders a 0×0 host node; we still keep it in the
  // tree (the widget needs a mount point) but it takes no layout space.
  return <div ref={containerRef} className="hidden" aria-hidden />;
}
