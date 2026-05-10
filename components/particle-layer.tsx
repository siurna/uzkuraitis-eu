"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { Flag } from "@/components/flag";

// One particle/burst layer for the whole room. Replaces the ad-hoc
// per-component fly-up implementations. Mount once via <ParticleLayer/>
// inside the room layout, then any descendant calls useParticles().spawn(...)
// to fire a single particle.
//
// Three kinds today:
//   - "emoji"   — a coloured circle with a white icon, floats up (reactions bar)
//   - "country" — a heart-flag chip, used for heart-to-slot fly-ins + swarms
//   - "image"   — an arbitrary <img src>, used for the 70-heart asset
//
// Particle ids are monotonic so multiple in-flight bursts on the same
// origin/target each animate independently.

export type ParticleAsset =
  | { type: "country"; code: string }
  | { type: "image"; src: string }
  | { type: "emoji-icon"; bg: string; icon: React.ReactNode };

export type ParticleSpec = {
  /** Stable id so AnimatePresence can track each particle. Auto-assigned
   *  by spawn() if omitted. */
  id?: number;
  asset: ParticleAsset;
  /** Origin (viewport coords). */
  from: { x: number; y: number };
  /** Destination (viewport coords). If omitted, particle drifts up. */
  to?: { x: number; y: number };
  /** Horizontal drift in px when no `to` is provided. Random within ±range. */
  driftRange?: number;
  /** Visual size in px. Default 56. */
  size?: number;
  /** Total animation duration in ms. Default 1100. */
  durationMs?: number;
  /** Rotation amplitude in degrees. Default 12. */
  rotate?: number;
};

type ParticlesContext = {
  spawn(spec: Omit<ParticleSpec, "id">): number;
  spawnMany(specs: Array<Omit<ParticleSpec, "id">>): void;
};

const Ctx = createContext<ParticlesContext | null>(null);

export function useParticles(): ParticlesContext {
  const ctx = useContext(Ctx);
  if (!ctx) {
    // Soft fallback so calling code never crashes if used outside the
    // layout (e.g. on the admin pages). Just no-ops.
    return { spawn: () => 0, spawnMany: () => {} };
  }
  return ctx;
}

type LiveParticle = ParticleSpec & { id: number };

let nextId = 1;

export function ParticleLayer({ children }: { children: React.ReactNode }) {
  const [particles, setParticles] = useState<LiveParticle[]>([]);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Cap so a flood (e.g. heart-swarm + reaction spam) doesn't tank perf.
  useEffect(() => {
    if (particles.length > 80) {
      setParticles((p) => p.slice(-60));
    }
  }, [particles]);

  const spawn = useCallback((spec: Omit<ParticleSpec, "id">) => {
    const id = nextId++;
    setParticles((p) => [...p, { ...spec, id }]);
    return id;
  }, []);

  const spawnMany = useCallback((specs: Array<Omit<ParticleSpec, "id">>) => {
    setParticles((p) => [
      ...p,
      ...specs.map((s) => ({ ...s, id: nextId++ })),
    ]);
  }, []);

  const value: ParticlesContext = { spawn, spawnMany };

  return (
    <Ctx.Provider value={value}>
      {children}
      {mounted &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[55] pointer-events-none overflow-hidden">
            <AnimatePresence>
              {particles.map((p) => (
                <ParticleSprite
                  key={p.id}
                  particle={p}
                  onDone={() =>
                    setParticles((all) => all.filter((x) => x.id !== p.id))
                  }
                />
              ))}
            </AnimatePresence>
          </div>,
          document.body,
        )}
    </Ctx.Provider>
  );
}

function ParticleSprite({
  particle: p,
  onDone,
}: {
  particle: LiveParticle;
  onDone: () => void;
}) {
  const size = p.size ?? 56;
  const half = size / 2;
  const duration = (p.durationMs ?? 1100) / 1000;
  const rotateAmp = p.rotate ?? 12;
  const drift =
    p.driftRange == null ? 0 : (Math.random() - 0.5) * p.driftRange;

  // Two motion paths:
  //   - to-targeted (heart fly-in to slot, swarm landing on a flag chip)
  //   - drift-up   (emoji reactions, gentle float)
  const initial = {
    left: p.from.x - half,
    top: p.from.y - half,
    opacity: 0,
    scale: 0.4,
    rotate: 0,
  };

  const animate = p.to
    ? {
        left: [p.from.x - half, p.to.x - half],
        top: [p.from.y - half, p.to.y - half],
        opacity: [0, 1, 1, 0],
        scale: [0.4, 1.4, 1, 0.5],
        rotate: [0, -rotateAmp, rotateAmp * 0.4, 0],
      }
    : {
        left: p.from.x - half + drift,
        top: p.from.y - half - 280,
        opacity: [0, 1, 1, 0],
        scale: [0.4, 1.3, 1, 0.8],
        rotate: [0, rotateAmp * (Math.random() - 0.5) * 2],
      };

  return (
    <motion.div
      initial={initial}
      animate={animate}
      exit={{ opacity: 0 }}
      transition={{
        duration,
        ease: p.to ? [0.34, 1.2, 0.64, 1] : [0.2, 0.7, 0.3, 1],
        opacity: { times: [0, 0.15, 0.7, 1] },
        scale: { times: [0, 0.25, 0.6, 1] },
      }}
      onAnimationComplete={onDone}
      className="absolute will-change-transform pointer-events-none
                 drop-shadow-[0_8px_24px_rgba(255,46,222,0.45)]"
      style={{ width: size, height: size }}
    >
      <ParticleAssetRenderer asset={p.asset} />
    </motion.div>
  );
}

function ParticleAssetRenderer({ asset }: { asset: ParticleAsset }) {
  if (asset.type === "country") {
    return <Flag code={asset.code} size="xl" className="h-full w-full" />;
  }
  if (asset.type === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={asset.src}
        alt=""
        className="h-full w-full object-contain"
      />
    );
  }
  // emoji-icon
  return (
    <div
      className={`h-full w-full rounded-full grid place-items-center
                  shadow-[0_6px_18px_-6px_rgba(0,0,0,0.6)] ${asset.bg}`}
    >
      <span className="text-white">{asset.icon}</span>
    </div>
  );
}
