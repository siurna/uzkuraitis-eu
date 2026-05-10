"use client";

import { motion, AnimatePresence } from "motion/react";
import { Flag } from "@/components/flag";
import { AVATARS, getAvatar, type Avatar } from "@/lib/avatars";
import { useLang, t } from "@/lib/i18n";

// Pick-an-avatar grid + a selection summary panel below it. Tile size
// bumped from the previous tiny grid; people kept missing it. Selected
// tile glows pink, scales up, and the panel below names the artist.
export function AvatarPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const selected = getAvatar(value);
  const lang = useLang();
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-white/60">{t(lang, "pick_avatar")}</p>
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-xs text-white/40 hover:text-white/70 transition"
          >
            {t(lang, "clear")}
          </button>
        )}
      </div>
      {/* No inner scroll: lets the parent BottomSheet handle vertical
          scrolling. Two scroll containers on the same page is exactly
          why the drawer "didn't work" — touches got captured by the
          inner picker and never reached the outer sheet. */}
      <ul className="grid grid-cols-4 sm:grid-cols-6 gap-2">
        {AVATARS.map((a) => (
          <Tile
            key={a.id}
            avatar={a}
            selected={value === a.id}
            onPick={() => onChange(a.id)}
          />
        ))}
      </ul>

      {/* Selection summary: the artist's name + country + year + song.
          Slides in / out so it's clear what was picked. */}
      <AnimatePresence initial={false}>
        {selected && (
          <motion.div
            key={selected.id}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="list-entry-gradient glass-card rounded-xl px-4 py-3 flex items-center gap-3">
              <Flag code={selected.country} size="lg" />
              <div className="flex-1 min-w-0">
                <p className="font-display truncate">{selected.artist}</p>
                <p className="text-xs text-white/55 truncate">
                  {selected.country.toUpperCase()} · {selected.year} ·{" "}
                  <span className="italic">{selected.song}</span>
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
        className={`relative aspect-square w-full rounded-xl overflow-hidden
                    transition transform-gpu duration-150
                    ${
                      selected
                        ? "ring-2 ring-flamingo shadow-glow-pink scale-[1.06]"
                        : "ring-1 ring-white/10 hover:ring-white/30 hover:scale-[1.03]"
                    }`}
      >
        {avatar.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatar.photo}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <Flag
            code={avatar.country}
            size="md"
            className="absolute inset-0 h-full w-full rounded-none"
          />
        )}
        <span
          className="absolute bottom-0 inset-x-0 px-1.5 py-0.5 text-[10px]
                     font-display tabular-nums text-white text-right
                     bg-gradient-to-t from-black/85 via-black/40 to-transparent"
        >
          &apos;{avatar.year.toString().slice(2)}
        </span>
      </motion.button>
    </motion.li>
  );
}
