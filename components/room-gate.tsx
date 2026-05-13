"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import Image from "next/image";
import { toast } from "sonner";
import { isValidRoomCode, normalizeRoomCode } from "@/lib/rooms";
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

  const submit = (next: string) => {
    const normalized = normalizeRoomCode(next);
    if (!isValidRoomCode(normalized)) {
      toast.error(t(lang, "bad_format"));
      return;
    }
    if (TURNSTILE_SITE_KEY && !tsToken) {
      // Widget hasn't fired its callback yet. The button is disabled in
      // that state, so this only catches Enter-key submissions.
      return;
    }
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
        return;
      }
      localStorage.setItem(LAST_ROOM_KEY, normalized);
      router.push(`/r/${normalized}`);
    });
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
                <TurnstileWidget
                  siteKey={TURNSTILE_SITE_KEY}
                  onToken={setTsToken}
                  onExpire={() => setTsToken(null)}
                />
              )}
              <Button
                type="submit"
                disabled={
                  pending ||
                  code.length < 6 ||
                  (!!TURNSTILE_SITE_KEY && !tsToken)
                }
                className="h-12 w-full font-display text-[19px] pt-[10px]
                           bg-gradient-to-r from-gold via-flamingo to-purple
                           text-white shadow-glow-pink
                           hover:opacity-95 disabled:opacity-40
                           disabled:bg-none disabled:bg-white/10"
              >
                {pending ? t(lang, "checking") : t(lang, "enter_room")}
              </Button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
