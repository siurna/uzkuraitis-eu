import Image from "next/image";
import { cn } from "@/lib/utils";

// ESC 2026 signature "country chip": a heart-shaped flag fused with a
// white pill carrying the country name. Lifted from eurovision.com's
// participant cards (the Austria/France/Germany rows the brand uses in
// every artist listing).
//
// Implementation:
//   - SVG <clipPath> draws a classic two-bump heart and clips a square
//     <image> of the flag SVG inside it. unique id per code stops two
//     hearts on the same page from bleeding.
//   - The white pill is a regular div pulled left so it overlaps the
//     heart's right lobe by ~8px, matching the brand's offset.
//   - `compact` drops the pill (heart only) for honeycomb / avatar
//     contexts where horizontal space is tight.
export function HeartFlag({
  code,
  name,
  className,
  size = "md",
}: {
  code: string;
  name?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const dims = {
    sm: { box: "h-7 w-7", pill: "text-xs px-2.5 py-0.5 -ml-2 h-7" },
    md: { box: "h-9 w-9", pill: "text-sm px-3 py-0.5 -ml-2.5 h-8" },
    lg: { box: "h-11 w-11", pill: "text-base px-3.5 py-0.5 -ml-3 h-9" },
  }[size];

  const safeId = `heart-${code.toLowerCase()}-${size}`;
  const flagSrc = `/flags/${code.toLowerCase()}.svg`;

  return (
    <div className={cn("inline-flex items-center", className)}>
      <svg
        viewBox="0 0 32 32"
        className={cn("shrink-0 drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]", dims.box)}
        aria-hidden
      >
        <defs>
          <clipPath id={safeId}>
            {/* Two-lobed heart, ~32×32, pointed bottom centred at (16,30). */}
            <path d="M16 29 C16 29, 2 19, 2 11 C2 6, 6 3, 9.5 3 C12.5 3, 15 5, 16 8 C17 5, 19.5 3, 22.5 3 C26 3, 30 6, 30 11 C30 19, 16 29, 16 29 Z" />
          </clipPath>
        </defs>
        <image
          href={flagSrc}
          width={32}
          height={32}
          preserveAspectRatio="xMidYMid slice"
          clipPath={`url(#${safeId})`}
        />
      </svg>
      {name && (
        <span
          className={cn(
            "relative z-[1] inline-flex items-center rounded-full bg-white text-dark-blue font-display whitespace-nowrap",
            dims.pill,
          )}
        >
          {name}
        </span>
      )}
    </div>
  );
}

// Small inline pill used to stack metadata next to the heart-flag chip
// (artist, song, etc.). Glassy light-blue with an optional leading icon.
export function MetaPill({
  icon: Icon,
  children,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 h-7 text-xs",
        "bg-white/10 text-white/90 ring-1 ring-white/15 whitespace-nowrap",
        className,
      )}
    >
      {Icon && <Icon className="h-3.5 w-3.5 text-white/70" />}
      {children}
    </span>
  );
}

// Backward-compat: the original rectangular flag, still used in places
// like the country drawer where a heart shape would feel weird.
type Size = "sm" | "md" | "lg" | "xl" | "row";

const SIZE_PX: Record<Size, { w: number; h: number; cls: string }> = {
  sm:  { w: 24, h: 18, cls: "h-[18px] w-[24px]" },
  md:  { w: 32, h: 24, cls: "h-6 w-8" },
  lg:  { w: 48, h: 36, cls: "h-9 w-12" },
  xl:  { w: 80, h: 60, cls: "h-[60px] w-[80px]" },
  row: { w: 40, h: 30, cls: "h-[30px] w-10" },
};

export function Flag({
  code,
  size = "md",
  className,
  alt,
}: {
  code: string;
  size?: Size;
  className?: string;
  alt?: string;
}) {
  const { w, h, cls } = SIZE_PX[size];
  return (
    <Image
      src={`/flags/${code.toLowerCase()}.svg`}
      width={w}
      height={h}
      alt={alt ?? `${code.toUpperCase()} flag`}
      className={cn("rounded-[3px] object-cover shrink-0 shadow-sm", cls, className)}
      unoptimized
    />
  );
}
