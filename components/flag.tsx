import Image from "next/image";
import { cn } from "@/lib/utils";

// Country flag rendered from /public/flags/<code>.svg.
//
// We pulled the SVGs straight from eurovision.com/static/images/flags so they
// match the contest's visual identity (and don't depend on the user's OS for
// emoji rendering — looking at you, Windows). Falls back to the emoji prop
// if the SVG file is somehow missing.
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
