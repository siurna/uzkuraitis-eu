"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import Image from "next/image";
import { toast } from "sonner";
import { Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import { isValidRoomCode, normalizeRoomCode } from "@/lib/room-code";
import { t } from "@/lib/i18n";
import { useLang } from "@/lib/i18n-client";
import { Button } from "@/components/ui/button";
import { CodeInput } from "@/components/code-input";
import { HeartbeatBackdrop } from "@/components/heartbeat-backdrop";
import { Logo2026 } from "@/components/logo-2026";
import { TurnstileWidget } from "@/components/turnstile";

const LAST_ROOM_KEY = "uzk_last_room";
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

  // While we're checking a remembered room, we want to show a loading
  // splash instead of flashing the empty input box. Distinct from `pending`
  // (which only covers user-initiated submits).
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
    const remembered = localStorage.getItem(LAST_ROOM_KEY);
    if (!remembered || !isValidRoomCode(remembered)) {
      setRehydrating(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/rooms/${remembered}`, { cache: "no-store" });
        if (cancelled) return;
        if (res.ok) {
          router.replace(`/r/${remembered}`);
        } else {
          // Stale code — room was deleted server-side. Drop the key and
          // fall through to the gate.
          localStorage.removeItem(LAST_ROOM_KEY);
          setRehydrating(false);
        }
      } catch {
        if (!cancelled) setRehydrating(false);
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

  return (
    <main className="relative min-h-dvh flex flex-col items-center justify-center px-4 py-12">
      <HeartbeatBackdrop />
      <AnimatePresence mode="wait">
        {rehydrating ? (
          <motion.div
            key="rehydrate"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-4 text-white/50"
          >
            {/* The 70-heart pulses while we check for a remembered
                room — same lub-dub as the rest of the brand, sized
                small. When loading completes, the gate fades in and
                Logo2026's full mark takes over. */}
            <div className="heartbeat-loop">
              <Image
                src="/images/70-heart.webp"
                alt=""
                width={64}
                height={64}
                priority
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
            transition={{ duration: 0.3 }}
            className="w-full max-w-sm flex flex-col items-center gap-8"
          >
            <Logo2026 className="w-full max-w-[14rem]" />

            <form
              onSubmit={(e) => {
                e.preventDefault();
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
                <>
                  <TurnstileWidget
                    siteKey={TURNSTILE_SITE_KEY}
                    onToken={onTurnstileToken}
                    onExpire={() => setTsToken(null)}
                    onError={onTurnstileError}
                    resetKey={tsResetKey}
                  />
                  {/* Status chip — explains the disabled state so it
                      doesn't read as "the form is broken". Three
                      cases: load failure (retry chip), verifying
                      (spinner), verified (green tick that fades). */}
                  <AnimatePresence mode="wait">
                    {tsError ? (
                      <motion.button
                        key="ts-error"
                        type="button"
                        onClick={retryTurnstile}
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="self-stretch inline-flex items-center gap-2 rounded-xl
                                   bg-error/12 ring-1 ring-error/35 text-error/95
                                   px-3 h-9 text-xs font-display active:scale-[0.98] transition"
                      >
                        <ShieldAlert className="h-3.5 w-3.5" />
                        {t(lang, "ts_error")}
                      </motion.button>
                    ) : !tsToken ? (
                      <motion.div
                        key="ts-checking"
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="self-stretch inline-flex items-center gap-2 rounded-xl
                                   bg-white/[0.04] ring-1 ring-white/10 text-white/55
                                   px-3 h-9 text-xs font-display"
                      >
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-flamingo" />
                        {t(lang, "ts_checking")}
                      </motion.div>
                    ) : (
                      <motion.div
                        key="ts-ok"
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="self-stretch inline-flex items-center gap-2 rounded-xl
                                   bg-turquoise/10 ring-1 ring-turquoise/30 text-turquoise/95
                                   px-3 h-9 text-xs font-display"
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        {t(lang, "ts_ok")}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}
              <button
                type="submit"
                disabled={
                  pending ||
                  code.length < 6 ||
                  (!!TURNSTILE_SITE_KEY && !tsToken && !tsError)
                }
                className="rainbow-border rounded-2xl w-full block disabled:opacity-40 transition"
              >
                <span
                  className="block w-full h-12 rounded-[14px] grid place-items-center gap-2
                             bg-white text-dark-blue font-display text-[19px] pt-[2px]"
                >
                  {pending ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t(lang, "checking")}
                    </span>
                  ) : armedRef.current && code.length === 6 ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t(lang, "ts_waiting_to_submit")}
                    </span>
                  ) : (
                    t(lang, "enter_room")
                  )}
                </span>
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
