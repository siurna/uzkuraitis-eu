"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { isValidRoomCode, normalizeRoomCode } from "@/lib/rooms";
import { Button } from "@/components/ui/button";
import { CodeInput } from "@/components/code-input";
import { Logo2026 } from "@/components/logo-2026";

const LAST_ROOM_KEY = "uzk_last_room";

export function RoomGate({ prefilled = "" }: { prefilled?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isLeaving = searchParams.get("leave") === "1";

  const [code, setCode] = useState(prefilled);
  const [pending, startTransition] = useTransition();

  // While we're checking a remembered room, we want to show a loading
  // splash instead of flashing the empty input box. Distinct from `pending`
  // (which only covers user-initiated submits).
  const [rehydrating, setRehydrating] = useState(!prefilled && !isLeaving);

  // On mount: if there's no prefilled code from ?room= and the user didn't
  // explicitly tap "Leave", check for a remembered room and bounce them
  // back into it. This survives phone sleep, tab restore, app reopen, etc.
  useEffect(() => {
    if (prefilled || isLeaving) {
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
      toast.error("Room codes are 6 characters (A–Z, 2–9).");
      return;
    }
    startTransition(async () => {
      const res = await fetch(`/api/rooms/${normalized}`, { cache: "no-store" });
      if (!res.ok) {
        toast.error("No room with that code.");
        return;
      }
      localStorage.setItem(LAST_ROOM_KEY, normalized);
      router.push(`/r/${normalized}`);
    });
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <AnimatePresence mode="wait">
        {rehydrating ? (
          <motion.div
            key="rehydrate"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-3 text-white/50"
          >
            <Loader2 className="h-6 w-6 animate-spin text-flamingo" />
            <p className="text-xs uppercase tracking-[0.3em] font-display">
              Reconnecting…
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="gate"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-md flex flex-col items-center gap-10"
          >
            <Logo2026 className="w-full max-w-xs" />

            <form
              onSubmit={(e) => {
                e.preventDefault();
                submit(code);
              }}
              className="w-full flex flex-col gap-6"
            >
              <CodeInput
                value={code}
                onChange={setCode}
                onComplete={submit}
                autoFocus
                disabled={pending}
              />
              <Button
                type="submit"
                disabled={pending || code.length < 6}
                className="h-14 text-lg font-display"
              >
                {pending ? "Checking…" : "Enter room"}
              </Button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
