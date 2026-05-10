"use client";

import { motion } from "motion/react";
import { Flag } from "@/components/flag";
import { AVATARS, type Avatar } from "@/lib/avatars";

// 5x8 (or so) grid of iconic Eurovision artists. Each tile renders the
// country flag plus a year subscript so cards stay readable at thumb-size
// without bundling 40 photo-rights-encumbered headshots. The chosen tile
// gets a flamingo glow ring so it's unambiguously selected.

export function AvatarPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-white/60">
          Pick an avatar (optional)
        </p>
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-xs text-white/40 hover:text-white/70 transition"
          >
            Clear
          </button>
        )}
      </div>
      <ul className="grid grid-cols-5 sm:grid-cols-8 gap-1.5 max-h-44 overflow-y-auto pr-1">
        {AVATARS.map((a) => (
          <Tile
            key={a.id}
            avatar={a}
            selected={value === a.id}
            onPick={() => onChange(a.id)}
          />
        ))}
      </ul>
    </div>
  );
}

function Tile({
  avatar,
  selected,
  onPick,
}: {
  avatar: Avatar;
  selected: boolean;
  onPick: () => void;
}) {
  return (
    <motion.li layout>
      <motion.button
        type="button"
        whileTap={{ scale: 0.92 }}
        onClick={onPick}
        title={`${avatar.artist} · ${avatar.country.toUpperCase()} ${avatar.year}`}
        aria-label={`${avatar.artist}, ${avatar.country.toUpperCase()} ${avatar.year}`}
        className={`relative aspect-square w-full rounded-lg overflow-hidden
                    transition transform-gpu duration-150
                    ${selected
                      ? "ring-2 ring-flamingo shadow-glow-pink scale-[1.04]"
                      : "ring-1 ring-white/10 hover:ring-white/30 hover:scale-[1.02]"}`}
      >
        <Flag
          code={avatar.country}
          size="md"
          className="absolute inset-0 h-full w-full rounded-none"
        />
        <span
          className="absolute bottom-0 right-0 text-[9px] font-display tabular-nums
                     bg-black/65 px-1 leading-tight rounded-tl-md"
        >
          &apos;{avatar.year.toString().slice(2)}
        </span>
      </motion.button>
    </motion.li>
  );
}
