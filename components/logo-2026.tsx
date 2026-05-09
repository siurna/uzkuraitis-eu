import Image from "next/image";
import { cn } from "@/lib/utils";

// Official Eurovision 2026 70-year wordmark, scraped from
// eurovision.com/static/images/. WebP, served at @4x for crisp HiDPI.
// The "United by music" ribbon below is the official ubm.svg asset.
export function Logo2026({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center text-center select-none gap-3",
        className,
      )}
    >
      <Image
        src="/images/70-logo@2x.webp"
        alt="Eurovision Song Contest"
        width={420}
        height={140}
        priority
        className="w-full max-w-[280px] h-auto drop-shadow-[0_0_24px_rgba(124,224,216,0.25)]"
      />
      <Image
        src="/images/ubm.svg"
        alt="United by music"
        width={120}
        height={32}
        className="opacity-80"
      />
      <p className="text-xs uppercase tracking-[0.4em] text-white/50 font-display">
        Vienna 2026
      </p>
    </div>
  );
}

// Compact version for nav bars / sticky headers.
export function HeartMark({ size = 24 }: { size?: number }) {
  return (
    <Image
      src="/images/70-heart-sm.webp"
      alt=""
      width={size}
      height={size}
      className="shrink-0"
    />
  );
}
