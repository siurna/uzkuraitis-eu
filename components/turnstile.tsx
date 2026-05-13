"use client";

import { useEffect, useRef } from "react";

// Cloudflare Turnstile widget. Loads the script lazily on first mount,
// then renders a managed-mode challenge. Reports the token via
// `onToken` and resets itself if the response expires.
//
// "managed" mode = Cloudflare decides whether to show a visible
// challenge based on passive signals. Most users never see anything —
// the widget appears, ~1s later it fires the token callback, done.

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
}: {
  siteKey: string;
  onToken: (token: string) => void;
  onExpire?: () => void;
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
        "error-callback": () => onExpire?.(),
        theme: "dark",
      });
      return true;
    };

    if (!render()) {
      // Script not loaded yet — poll briefly until the global appears.
      const interval = window.setInterval(() => {
        if (render()) window.clearInterval(interval);
      }, 100);
      const timeout = window.setTimeout(() => window.clearInterval(interval), 8000);
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
    // siteKey + callbacks pinned at mount; component is destroyed/
    // remounted if siteKey ever changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey]);

  return <div ref={containerRef} className="flex justify-center" />;
}
