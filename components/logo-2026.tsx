import { cn } from "@/lib/utils";

// Lightweight reproduction of the 2026 brand mark (refresh — the cursive E
// + heart wordmark). This is not the official asset; it's a typographic
// echo for our own UI. Drop the official PNG/SVG in /public/images/ and
// swap the markup below for an <Image> if you want pixel-perfect branding.
export function Logo2026({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center text-center select-none",
        className,
      )}
    >
      <p
        className="font-display text-[clamp(2.5rem,8vw,4.5rem)] leading-none gradient-text"
        aria-label="Eurovision"
      >
        eurovision
      </p>
      <div className="mt-2 flex items-center gap-2 text-xs uppercase tracking-[0.4em] text-white/60 font-display">
        <span className="h-px w-6 bg-white/30" />
        Vienna 2026
        <span className="h-px w-6 bg-white/30" />
      </div>
    </div>
  );
}
