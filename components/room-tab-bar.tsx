"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import {
  Home,
  MessageCircle,
  Grid3x3,
  Vote,
  type LucideProps,
} from "lucide-react";
import type { Route } from "next";
import { useLang, t } from "@/lib/i18n";

// Bottom dock. Each tab is a real route; the active pill layoutId-
// animates between them. Brand-gradient active state per tab so the
// dock itself reads as ESC-coloured rather than monochrome white.
type TabDef = {
  href: (code: string) => Route;
  labelKey: "tab_home" | "tab_chat" | "tab_bingo" | "tab_vote";
  Icon: React.ComponentType<LucideProps>;
  /** Tailwind gradient classes for the active pill bg. */
  gradient: string;
  /** Glow colour applied to the active icon's drop-shadow + the pill ring. */
  glow: string;
  match: (pathname: string, code: string) => boolean;
};

const TABS: TabDef[] = [
  {
    href: (code) => `/r/${code}` as Route,
    labelKey: "tab_home",
    Icon: Home,
    gradient: "from-flamingo via-fuchsia to-orange",
    glow: "shadow-[0_8px_22px_-6px_oklch(70%_0.27_336_/_0.65)]",
    match: (p, code) => p === `/r/${code}`,
  },
  {
    href: (code) => `/r/${code}/chat` as Route,
    labelKey: "tab_chat",
    Icon: MessageCircle,
    gradient: "from-turquoise via-blue to-purple",
    glow: "shadow-[0_8px_22px_-6px_oklch(78%_0.13_190_/_0.55)]",
    match: (p, code) => p.startsWith(`/r/${code}/chat`),
  },
  {
    href: (code) => `/r/${code}/bingo` as Route,
    labelKey: "tab_bingo",
    Icon: Grid3x3,
    gradient: "from-purple via-fuchsia to-flamingo",
    glow: "shadow-[0_8px_22px_-6px_oklch(42%_0.20_295_/_0.65)]",
    match: (p, code) => p.startsWith(`/r/${code}/bingo`),
  },
  {
    href: (code) => `/r/${code}/vote` as Route,
    labelKey: "tab_vote",
    Icon: Vote,
    gradient: "from-yellow via-orange to-fuchsia",
    glow: "shadow-[0_8px_22px_-6px_oklch(95%_0.19_108_/_0.55)]",
    match: (p, code) => p.startsWith(`/r/${code}/vote`),
  },
];

export function RoomTabBar({
  code,
  chatUnread = 0,
}: {
  code: string;
  chatUnread?: number;
}) {
  const pathname = usePathname();
  const lang = useLang();
  const activeIdx = TABS.findIndex((tab) => tab.match(pathname, code));
  const active = TABS[Math.max(0, activeIdx)];

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 px-3
                 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2
                 bg-gradient-to-t from-dark-blue-900 via-dark-blue-900/92 to-transparent"
    >
      <ul
        className="mx-auto max-w-md flex items-stretch justify-around gap-1
                   rounded-[28px] bg-black/55 ring-1 ring-white/10 p-1.5 backdrop-blur-md"
      >
        {TABS.map(({ href, labelKey, Icon, gradient, glow, match }, i) => {
          const isActive = match(pathname, code);
          const label = t(lang, labelKey);
          return (
            <li key={i} className="flex-1">
              <Link
                href={href(code)}
                aria-label={label}
                aria-current={isActive ? "page" : undefined}
                className="relative flex flex-col items-center justify-center gap-1
                           py-2 rounded-2xl"
              >
                {isActive && (
                  <motion.span
                    layoutId="tab-pill"
                    className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${gradient} ${glow}`}
                    transition={{
                      type: "spring",
                      stiffness: 360,
                      damping: 32,
                      mass: 0.8,
                    }}
                  />
                )}
                <motion.div
                  initial={false}
                  animate={{ scale: isActive ? 1.08 : 1 }}
                  transition={{ type: "spring", stiffness: 380, damping: 26 }}
                  className="relative"
                >
                  <Icon
                    className={`h-6 w-6 transition ${
                      isActive ? "text-white" : "text-white/55"
                    }`}
                    strokeWidth={isActive ? 2.4 : 2}
                  />
                  {/* Unread badge on the Chat tab. */}
                  {labelKey === "tab_chat" && chatUnread > 0 && (
                    <span className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] px-1
                                     rounded-full bg-fuchsia text-white text-[10px]
                                     font-display tabular-nums grid place-items-center
                                     ring-2 ring-black/55">
                      {chatUnread > 9 ? "9+" : chatUnread}
                    </span>
                  )}
                </motion.div>
                <span
                  className={`relative text-[10px] font-display tracking-wide leading-none
                              transition ${isActive ? "text-white" : "text-white/55"}`}
                >
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {/* Hidden accessor for screen readers — reads the current tab
          gradient direction for completeness. */}
      <span hidden aria-hidden>{active?.gradient}</span>
    </nav>
  );
}
