"use client";

import { Check } from "lucide-react";
import { Flag } from "@/components/flag";
import { AVATARS, getAvatar, type Avatar } from "@/lib/avatars";
import { useLang, t } from "@/lib/i18n";

// Pick-an-avatar grid. Apple-Watch-style rounded-square tiles with a
// face-cropped photo inside; selection is shown as a fuchsia ring +
// check pip in the corner — no scale jiggle, no layout animations,
// just a discrete "this one's chosen" state.
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
      {value && (
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-xs text-white/40 hover:text-white/70 transition"
          >
            {t(lang, "clear")}
          </button>
        </div>
      )}
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

      {selected && (
        <div className="glass-card rounded-2xl px-4 py-3 flex items-center gap-3">
          <Flag code={selected.country} size="lg" />
          <div className="flex-1 min-w-0">
            <p className="font-display truncate">{selected.artist}</p>
            <p className="text-xs text-white/55 truncate">
              {selected.country.toUpperCase()} · {selected.year} ·{" "}
              <span className="italic">{selected.song}</span>
            </p>
          </div>
        </div>
      )}
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
    <li>
      <button
        type="button"
        onClick={onPick}
        title={`${avatar.artist} · ${avatar.country.toUpperCase()} ${avatar.year}`}
        aria-label={`${avatar.artist}, ${avatar.country.toUpperCase()} ${avatar.year}`}
        aria-pressed={selected}
        className={`relative aspect-square w-full rounded-2xl overflow-hidden
                    transition-[box-shadow,outline-color,transform] duration-150 ease-out
                    active:scale-[0.96] focus-visible:outline-none
                    outline outline-2 outline-offset-[-2px]
                    ${
                      selected
                        ? "outline-fuchsia shadow-[0_0_0_3px_oklch(61.3%_0.2412_13.09_/_0.35)]"
                        : "outline-white/10 hover:outline-white/35"
                    }`}
      >
        {avatar.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatar.photo}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            style={{
              objectPosition: avatar.focal
                ? `${avatar.focal.x}% ${avatar.focal.y}%`
                : "50% 30%",
            }}
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
        {selected && (
          <span
            className="absolute top-1 right-1 h-5 w-5 rounded-full bg-fuchsia
                       grid place-items-center shadow"
          >
            <Check className="h-3 w-3 text-white" strokeWidth={3} />
          </span>
        )}
      </button>
    </li>
  );
}
