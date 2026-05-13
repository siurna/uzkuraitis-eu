import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Compact relative-time formatter — "just now", "3m ago", "2h ago",
// "5d ago". Used by every admin list (rooms, broadcasts, participant
// messages) — same buckets so the chrome reads as one thing.
export function timeAgo(input: Date | string): string {
  const t = input instanceof Date ? input.getTime() : new Date(input).getTime();
  const ms = Date.now() - t;
  const m = Math.round(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}
