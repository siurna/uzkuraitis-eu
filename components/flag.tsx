import Image from "next/image";
import { cn } from "@/lib/utils";

// The /public/flags/<code>.svg files lifted from eurovision.com are
// already heart-shaped (clipped to the ESC anniversary heart with a
// white outline frame). We just render them at the requested size and
// let the SVG do its thing — no extra clipPath, no object-fit gymnastics.
//
// Natural aspect ≈ 127:131 (essentially square), so a single square
// "size" tuple is enough.

type Size = "sm" | "md" | "lg" | "xl" | "row";

const SIZE_PX: Record<Size, { px: number; cls: string }> = {
  sm:  { px: 24, cls: "h-6 w-6" },
  md:  { px: 36, cls: "h-9 w-9" },
  row: { px: 40, cls: "h-10 w-10" },
  lg:  { px: 48, cls: "h-12 w-12" },
  xl:  { px: 72, cls: "h-[72px] w-[72px]" },
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
  const { px, cls } = SIZE_PX[size];
  return (
    <Image
      src={`/flags/${code.toLowerCase()}.svg`}
      width={px}
      height={px}
      alt={alt ?? `${code.toUpperCase()} flag`}
      className={cn("shrink-0 select-none", cls, className)}
      unoptimized
      draggable={false}
    />
  );
}

// Country chip in the ESC standings style: heart-flag fused with a
// white pill carrying the country name. Uses <Flag/> directly since
// the SVG is already heart-shaped — the pill is just a white capsule
// pulled left to overlap the heart's right lobe slightly.
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
  const flagSize: Size = size === "sm" ? "sm" : size === "lg" ? "lg" : "md";
  const pill = {
    sm: "text-xs px-2.5 -ml-2 h-6",
    md: "text-sm px-3 -ml-2 h-7",
    lg: "text-base px-3.5 -ml-2.5 h-8",
  }[size];

  return (
    <div className={cn("inline-flex items-center", className)}>
      <Flag code={code} size={flagSize} />
      {name && (
        <span
          className={cn(
            "relative z-[1] inline-flex items-center rounded-full",
            "bg-white text-dark-blue font-display whitespace-nowrap",
            pill,
          )}
        >
          {name}
        </span>
      )}
    </div>
  );
}

// Inline metadata pill (artist / song). Glassy translucent capsule
// with optional leading icon, sits next to <HeartFlag/> in lists.
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
