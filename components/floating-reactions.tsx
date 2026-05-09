"use client";

import { useEffect, useRef, useState } from "react";
import { useBroadcastEvent, useEventListener } from "@/lib/liveblocks";

const EMOJIS = ["❤️", "🔥", "🎤", "✨", "💃", "🇪🇺", "🥲", "💯"] as const;

type Float = {
  id: number;
  emoji: string;
  x: number;
  y: number;
  origin: "self" | "remote";
};

let nextFloatId = 1;

export function FloatingReactionsLayer({ code }: { code: string }) {
  const [floats, setFloats] = useState<Float[]>([]);
  const broadcast = useBroadcastEvent();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Dispose of finished floats so we don't leak DOM nodes after long parties.
  useEffect(() => {
    if (floats.length === 0) return;
    const timer = setTimeout(() => {
      setFloats((prev) => prev.slice(-30));
    }, 1700);
    return () => clearTimeout(timer);
  }, [floats]);

  useEventListener(({ event }) => {
    if (event.type !== "floating") return;
    setFloats((prev) => [
      ...prev,
      {
        id: nextFloatId++,
        emoji: event.emoji,
        x: event.x,
        y: event.y,
        origin: "remote",
      },
    ]);
  });

  const send = (emoji: string) => {
    const x = window.innerWidth / 2 + (Math.random() - 0.5) * 80;
    const y = window.innerHeight - 120;
    broadcast({ type: "floating", emoji, x, y });
    setFloats((prev) => [
      ...prev,
      { id: nextFloatId++, emoji, x, y, origin: "self" },
    ]);
    // best-effort haptic on supported devices
    if ("vibrate" in navigator) navigator.vibrate?.(8);
  };

  return (
    <>
      {/* Floating layer — pointer-events:none so taps pass through. */}
      <div className="fixed inset-0 z-40 pointer-events-none">
        {floats.map((f) => (
          <span
            key={f.id}
            className="absolute text-4xl float-up will-change-transform"
            style={{ left: f.x - 16, top: f.y, filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.4))" }}
          >
            {f.emoji}
          </span>
        ))}
      </div>

      {/* Reaction toolbar pinned above the bottom CTA. */}
      <div className="fixed bottom-20 left-0 right-0 z-30 flex justify-center pointer-events-none">
        <div className="pointer-events-auto glass-card rounded-full px-2 py-1 flex gap-1 shadow-glow-pink">
          {EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => send(e)}
              className="h-10 w-10 grid place-items-center rounded-full hover:bg-white/10 active:scale-110 transition text-2xl"
              aria-label={`React with ${e}`}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      <audio ref={audioRef} preload="none" />
      {/* room id is passed for future per-room reaction sounds */}
      <span data-room={code} hidden />
    </>
  );
}
