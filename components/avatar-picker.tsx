"use client";

import { Check } from "lucide-react";
import { Flag } from "@/components/flag";
import { AVATARS, type Avatar } from "@/lib/avatars";
import { optimizedSrc } from "@/lib/img";

// Pick-an-avatar grid. Apple-Watch-style rounded-square tiles with a
// face-cropped photo inside; selection is shown as a fuchsia ring +
// check pip in the corner. Picking is required to continue, so there's
// no "clear" affordance — pick a different one to change.
//
// `pulseSelected` makes the chosen tile heartbeat so the user gets
// immediate "yep, that one" feedback before submitting.
export function AvatarPicker({
  value,
  onChange,
  pulseSelected = false,
}: {
  value: string | null;
  onChange: (id: string) => void;
  pulseSelected?: boolean;
}) {
  return (
    <ul className="grid grid-cols-4 gap-2.5">
      {AVATARS.map((a) => (
        <Tile
          key={a.id}
          avatar={a}
          selected={value === a.id}
          pulse={pulseSelected && value === a.id}
          onPick={() => onChange(a.id)}
        />
      ))}
    </ul>
  );
}

function Tile({
  avatar,
  selected,
  pulse,
  onPick,
}: {
  avatar: Avatar;
  selected: boolean;
  pulse: boolean;
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
                    } ${pulse ? "heartbeat-loop" : ""}`}
      >
        {avatar.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={optimizedSrc(avatar.photo, 128)}
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
