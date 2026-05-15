"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { Loader2, ShieldAlert } from "lucide-react";
import { isValidRoomCode, normalizeRoomCode } from "@/lib/room-code";
import { t } from "@/lib/i18n";
import { useLang } from "@/lib/i18n-client";
import { Button } from "@/components/ui/button";
import { CodeInput } from "@/components/code-input";
import { HeartbeatBackdrop } from "@/components/heartbeat-backdrop";
import { InstallPwaPrompt } from "@/components/install-pwa-prompt";
import { isInstalledPwa } from "@/components/notification-toggles";
import { Logo2026 } from "@/components/logo-2026";
import { TurnstileWidget } from "@/components/turnstile";

const LAST_ROOM_KEY = "uzk_last_room";
// Minimum loader hold so the central heart actually beats. The
// .heartbeat-loop CSS animation is a 1.4s cycle with a 0.4s lead-in.
// 3.6s gives the user ~two-and-a-half full thumps after the lead-in,
// which reads as "the app is breathing" instead of "a flash". A
// short network reply still respects this floor.
const MIN_HEARTBEAT_HOLD_MS = 3600;
// Public site key gets inlined at build time when configured. When it
// isn't set we render the gate without the widget and the server-side
// verify endpoint passes everything through — same flow, no friction.
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null;

export function RoomGate({ prefilled = "" }: { prefilled?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isLeaving = searchParams.get("leave") === "1";
  const lang = useLang();

  const [code, setCode] = useState(prefilled);
  const [pending, startTransition] = useTransition();
  // Turnstile token from the widget — null until the user clears the
  // challenge. When the env var isn't set we don't gate on it.
  const [tsToken, setTsToken] = useState<string | null>(null);
  // "couldn't reach Cloudflare" state — script blocked / hard fail.
  // Surfaces a retry chip so the join button doesn't sit dead forever.
  const [tsError, setTsError] = useState(false);
  // Bump to force the widget to re-mount on Retry.
  const [tsResetKey, setTsResetKey] = useState(0);
  // "User finished typing the code before the token arrived" guard.
  // When true, the moment the token lands we auto-submit so the form
  // feels like it caught up. Without this the user types six chars,
  // sees nothing happen for several seconds, and assumes it's broken.
  const armedRef = useRef(false);

  // Track whether the install banner is going to render on this
  // viewport. The gate's pull-up (pt-[18dvh] + pb-32 on mobile)
  // ONLY makes sense when there's a CTA at the bottom to balance
  // against — if the user has already installed the PWA, that
  // banner is gone and pulling the logo up just stacks the form
  // awkwardly against the top of the screen. SSR-safe: starts
  // false, post-mount effect flips it to the real value.
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  useEffect(() => {
    setShowInstallBanner(!isInstalledPwa());
  }, []);

  // While we're checking a remembered room, we want to show a loading
  // splash instead of flashing the empty input box. Distinct from `pending`
  // (which only covers user-initiated submits).
  //
  // Minimum heartbeat hold: the loader's central heart pulses on a 1.05s
  // keyframe cycle. On a fast connection /api/rooms/X resolves in ~150ms
  // and the heart never finishes a single beat — feels like a flash, not
  // a moment. We keep `rehydrating` true for at least `MIN_HOLD_MS` so
  // the heart gets to play out three full cycles regardless of how
  // quickly the room check returns. Past that, the natural network
  // jitter handles the rest.
  const [rehydrating, setRehydrating] = useState(!prefilled && !isLeaving);

  // On mount: if there's no prefilled code from ?room= and the user didn't
  // explicitly tap "Leave", check for a remembered room and bounce them
  // back into it. This survives phone sleep, tab restore, app reopen, etc.
  //
  // BUT — if the user got here via the browser's back button (popstate
  // navigation), don't auto-redirect, otherwise the back button is
  // useless: it sends you to /, we re-redirect into the room you just
  // backed out of, infinite loop. The Performance Navigation API's
  // "back_forward" type is the cleanest signal for this.
  useEffect(() => {
    if (prefilled || isLeaving) {
      setRehydrating(false);
      return;
    }
    const navType = (
      typeof performance !== "undefined"
        ? (performance.getEntriesByType("navigation")[0] as
            | PerformanceNavigationTiming
            | undefined)?.type
        : undefined
    );
    if (navType === "back_forward") {
      setRehydrating(false);
      return;
    }
    const startedAt = performance.now();
    const remembered = localStorage.getItem(LAST_ROOM_KEY);
    // Race the heartbeat hold against the room-check fetch (when there
    // IS a remembered code) or just hold the heartbeat (when there
    // isn't). Either way, we don't drop the loader before the heart
    // has had its three beats.
    let cancelled = false;
    const settle = (next: () => void) => {
      const elapsed = performance.now() - startedAt;
      const wait = Math.max(0, MIN_HEARTBEAT_HOLD_MS - elapsed);
      window.setTimeout(() => {
        if (!cancelled) next();
      }, wait);
    };

    if (!remembered || !isValidRoomCode(remembered)) {
      settle(() => setRehydrating(false));
      return () => {
        cancelled = true;
      };
    }
    (async () => {
      try {
        const res = await fetch(`/api/rooms/${remembered}`, { cache: "no-store" });
        if (cancelled) return;
        if (res.ok) {
          settle(() => router.replace(`/r/${remembered}`));
        } else {
          // Stale code — room was deleted server-side. Drop the key and
          // fall through to the gate.
          localStorage.removeItem(LAST_ROOM_KEY);
          settle(() => setRehydrating(false));
        }
      } catch {
        settle(() => setRehydrating(false));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [prefilled, isLeaving, router]);

  // If they hit the gate via "Leave room", clear the persisted code so we
  // don't bounce them right back on the next reload.
  useEffect(() => {
    if (isLeaving) localStorage.removeItem(LAST_ROOM_KEY);
  }, [isLeaving]);

  // Register the service worker from the LOGIN page (not just inside
  // a room). Chrome's PWA installability heuristic only shows the
  // address-bar install icon when a SW with a fetch handler is
  // registered AND has handled a navigation request — without this,
  // first-time visitors on /  saw the manifest but no install icon.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  const submit = useCallback(
    (next: string) => {
      const normalized = normalizeRoomCode(next);
      if (!isValidRoomCode(normalized)) {
        toast.error(t(lang, "bad_format"));
        return;
      }
      if (TURNSTILE_SITE_KEY && !tsToken) {
        // Token hasn't landed yet. Arm so the next token arrival
        // auto-submits with this code in hand — no second tap from
        // the user. The button stays disabled visually so they know
        // we're waiting, the status pill explains why.
        armedRef.current = true;
        return;
      }
      armedRef.current = false;
      startTransition(async () => {
        // /api/rooms/verify-join checks Turnstile + room existence in
        // one call and sets the per-room cookie middleware looks for.
        const res = await fetch("/api/rooms/verify-join", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ code: normalized, token: tsToken ?? undefined }),
        });
        if (!res.ok) {
          const { error } = (await res.json().catch(() => ({}))) as { error?: string };
          toast.error(error ?? t(lang, "bad_code"));
          setTsToken(null); // force the user to clear a fresh challenge
          setTsResetKey((k) => k + 1); // re-mount widget to fetch a new token
          return;
        }
        localStorage.setItem(LAST_ROOM_KEY, normalized);
        router.push(`/r/${normalized}`);
      });
    },
    [lang, router, tsToken],
  );

  // Wire the token callback to drain `armedRef`: if the user already
  // finished typing the 6-char code, the form auto-submits the moment
  // the token lands. Otherwise this is a no-op and the user taps Enter
  // themselves with the now-enabled button.
  const onTurnstileToken = useCallback(
    (token: string) => {
      setTsToken(token);
      setTsError(false);
      if (armedRef.current && code.length === 6) {
        submit(code);
      }
    },
    [code, submit],
  );

  const onTurnstileError = useCallback(() => {
    setTsToken(null);
    setTsError(true);
    armedRef.current = false;
  }, []);

  const retryTurnstile = () => {
    setTsError(false);
    setTsToken(null);
    setTsResetKey((k) => k + 1);
  };

  // Soft-timeout fallback for Turnstile. The widget's own onError
  // fires for script load failure + the 8s "didn't initialise"
  // case, but if the challenge ITSELF stalls (script loaded, widget
  // mounted, Cloudflare just never returns a token), we'd otherwise
  // sit on "Tikrinama, ar žmogus…" forever. After 12s with no
  // token AND no prior error, treat as a hard failure so the user
  // sees the retry chip and isn't trapped.
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    if (tsToken || tsError) return;
    const id = window.setTimeout(() => {
      if (!tsToken) {
        setTsError(true);
        armedRef.current = false;
      }
    }, 12_000);
    return () => window.clearTimeout(id);
  }, [tsToken, tsError, tsResetKey]);

  return (
    <main
      className={`relative min-h-dvh flex flex-col items-center px-4 ${
        // Three layout cases:
        //   1. rehydrate state — justify-center INSIDE the safe-area
        //      insets. On iOS PWA, min-h-dvh covers the notch + home-
        //      indicator areas, so a plain justify-center centred
        //      against geometric middle (slightly low against the
        //      visible middle). Safe-area padding pulls it back.
        //   2. gate + install banner showing — mobile pulls logo+form
        //      up (pt-[18dvh] + pb-32) so they balance ABOVE the
        //      install CTA that sits near the bottom. Desktop
        //      ignores the pull (sm:justify-center).
        //   3. gate + NO install banner (PWA already installed) —
        //      no banner to balance against, so plain justify-center
        //      on every viewport. The pull-up would just shove the
        //      logo into the top of the screen for no reason.
        rehydrating
          ? "justify-center pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
          : showInstallBanner
            ? "pt-[18dvh] pb-32 sm:justify-center sm:pt-12 sm:pb-12"
            : "justify-center py-12"
      }`}
    >
      {/* Splash-to-app handoff. The iOS/Android PWA splash is the
          manifest's solid `#10142a`; first paint of the gate paints
          a downward gradient on top so the splash colour appears to
          extend into the page. The gradient fades out, revealing
          html::before's brand backdrop (heart blooms + texture) and
          the HeartbeatBackdrop layer underneath. No splash images
          required — the colour at the very top stays #10142a long
          enough that the OS splash hands off without a flash. */}
      <motion.div
        aria-hidden
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
        className="fixed inset-0 -z-[1] pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, #10142a 0%, #1d1546 45%, #3a1664 100%)",
        }}
      />
      <HeartbeatBackdrop />
      {/* Install-this-app prompt. Self-hides when running in PWA
          standalone mode. Also suppressed during the reconnecting
          loader — we're about to redirect into a room, no reason
          to surface "install the app" mid-transition. */}
      {!rehydrating && <InstallPwaPrompt />}
      <AnimatePresence mode="wait">
        {rehydrating ? (
          <motion.div
            key="rehydrate"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            // Plain flex item inside the centered main — when
            // `rehydrating` is true the parent <main> drops its top/
            // bottom padding and switches to justify-center, so the
            // loader naturally sits dead-centre on the viewport
            // without needing a `fixed inset-0` overlay (which was
            // covering the install banner + reading as a "container
            // extended to full screen height").
            className="flex flex-col items-center gap-4 text-white/50"
          >
            {/* The 70-heart pulses while we check for a remembered
                room. Plain `<img>` instead of `next/image`: iOS
                Safari computes `drop-shadow` against the wrapper
                span's bounding box until the WebP fully decodes,
                which renders a transparent square halo around the
                heart for the first frame. */}
            <div className="heartbeat-loop">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/70-heart.webp"
                alt=""
                width={64}
                height={64}
                className="h-16 w-16 object-contain
                           drop-shadow-[0_0_24px_rgba(255,46,222,0.5)]"
              />
            </div>
            <p className="text-xs uppercase tracking-[0.3em] font-display">
              {t(lang, "reconnecting")}
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="gate"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            // 0.5s delay so the gate stays hidden until the splash
            // gradient is mostly faded; user reads it as the
            // backdrop being unveiled before the form fades up.
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1], delay: 0.5 }}
            className="w-full max-w-sm flex flex-col items-center gap-8"
          >
            <Logo2026 className="w-full max-w-[14rem]" />

            <form
              onSubmit={(e) => {
                e.preventDefault();
                // Enter when ts is in the error state: keyboard
                // submitters still get a productive action (retry the
                // challenge) instead of a no-op arm.
                if (tsError) {
                  retryTurnstile();
                  return;
                }
                submit(code);
              }}
              className="glass-card w-full rounded-2xl p-5 flex flex-col gap-4"
            >
              <CodeInput
                value={code}
                onChange={setCode}
                onComplete={submit}
                autoFocus
                disabled={pending}
              />
              {TURNSTILE_SITE_KEY && (
                <TurnstileWidget
                  siteKey={TURNSTILE_SITE_KEY}
                  onToken={onTurnstileToken}
                  onExpire={() => setTsToken(null)}
                  onError={onTurnstileError}
                  resetKey={tsResetKey}
                />
              )}
              {/* Single CTA slot that absorbs Turnstile status so the
                  form isn't a button + a banner. Three visual states:
                  - error → tinted retry chip (taps `retryTurnstile`)
                  - verifying → rainbow-border CTA disabled + in-pill
                    spinner with the ts_checking copy
                  - ready / submitting → rainbow-border CTA with the
                    join copy or the submitting spinner.
                  The form's onSubmit still fires on Enter; it falls
                  through to `retryTurnstile` when we're in the error
                  branch so the keyboard path doesn't dead-end. */}
              {tsError ? (
                <button
                  type="button"
                  onClick={retryTurnstile}
                  className="w-full h-12 rounded-2xl inline-flex items-center justify-center gap-2
                             bg-error/12 ring-1 ring-error/35 text-error/95
                             font-display text-base active:scale-[0.98] transition"
                >
                  <ShieldAlert className="h-4 w-4" />
                  {t(lang, "ts_error")}
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={
                    pending ||
                    code.length < 6 ||
                    (!!TURNSTILE_SITE_KEY && !tsToken)
                  }
                  className="rainbow-border rounded-2xl w-full block transition"
                  // Opacity ramps with how many code characters have
                  // been typed: 0 chars = 0.4 (clearly inactive), each
                  // typed char adds 0.1, 6 chars = 1.0 (CTA fully lit).
                  // Replaces the binary disabled:opacity-40 jump so the
                  // user feels their progress.
                  style={{
                    opacity: pending
                      ? 0.7
                      : Math.min(1, 0.4 + Math.min(code.length, 6) * 0.1),
                  }}
                >
                  <span
                    className="block w-full h-12 rounded-[14px] grid place-items-center gap-2
                               bg-white text-dark-blue font-display text-[19px] leading-none pt-[3px]"
                  >
                    {pending ? (
                      <span className="inline-flex items-center gap-2 leading-none">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t(lang, "checking")}
                      </span>
                    ) : !!TURNSTILE_SITE_KEY && !tsToken ? (
                      <span className="inline-flex items-center gap-2 leading-none">
                        <Loader2 className="h-4 w-4 animate-spin text-flamingo" />
                        <span className="text-base text-dark-blue/75">
                          {t(lang, "ts_checking")}
                        </span>
                      </span>
                    ) : armedRef.current && code.length === 6 ? (
                      <span className="inline-flex items-center gap-2 leading-none">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t(lang, "ts_waiting_to_submit")}
                      </span>
                    ) : code.length < 6 ? (
                      // Disabled "type your code" hint instead of a
                      // dead-looking "Enter room" — reads as guidance,
                      // flips back to the active CTA the moment the
                      // 6th character lands.
                      <span className="text-dark-blue/55">{t(lang, "enter_code_hint")}</span>
                    ) : (
                      t(lang, "enter_room")
                    )}
                  </span>
                </button>
              )}
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
