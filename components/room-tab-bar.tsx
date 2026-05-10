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

// Bottom-fixed nav, mobile + desktop. Each tab is a real route so deep
// links + browser back work. ESC brand palette (flamingo / turquoise
// / purple / fuchsia) instead of iOS system colours — picks land on
// our existing @theme tokens so they pick up the brand bloom backdrop
// naturally. Icon + label so users don't have to guess.
type TabDef = {
  href: (code: string) => Route;
  labelKey: "tab_home" | "tab_chat" | "tab_bingo" | "tab_vote";
  Icon: React.ComponentType<LucideProps>;
  /** Active-pill background colour. ESC palette tokens. */
  bg: string;
  match: (pathname: string, code: string) => boolean;
};

const TABS: TabDef[] = [
  {
    href: (code) => `/r/${code}` as Route,
    labelKey: "tab_home",
    Icon: Home,
    bg: "bg-flamingo",
    match: (p, code) => p === `/r/${code}`,
  },
  {
    href: (code) => `/r/${code}/chat` as Route,
    labelKey: "tab_chat",
    Icon: MessageCircle,
    bg: "bg-turquoise",
    match: (p, code) => p.startsWith(`/r/${code}/chat`),
  },
  {
    href: (code) => `/r/${code}/bingo` as Route,
    labelKey: "tab_bingo",
    Icon: Grid3x3,
    bg: "bg-purple",
    match: (p, code) => p.startsWith(`/r/${code}/bingo`),
  },
  {
    href: (code) => `/r/${code}/vote` as Route,
    labelKey: "tab_vote",
    Icon: Vote,
    bg: "bg-fuchsia",
    match: (p, code) => p.startsWith(`/r/${code}/vote`),
  },
];

export function RoomTabBar({ code }: { code: string }) {
  const pathname = usePathname();
  const lang = useLang();
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 px-3
                 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2
                 bg-gradient-to-t from-dark-blue-900 via-dark-blue-900/90 to-transparent"
    >
      <ul
        className="mx-auto max-w-md flex items-stretch justify-around gap-1
                   rounded-3xl bg-black/55 ring-1 ring-white/10 p-1.5 backdrop-blur-md"
      >
        {TABS.map(({ href, labelKey, Icon, bg, match }, i) => {
          const active = match(pathname, code);
          const label = t(lang, labelKey);
          return (
            <li key={i} className="flex-1">
              <Link
                href={href(code)}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                className="relative flex flex-col items-center justify-center gap-0.5
                           py-1.5 rounded-2xl"
              >
                {active && (
                  <motion.span
                    layoutId="tab-pill"
                    className={`absolute inset-0 rounded-2xl ${bg}
                                shadow-[0_6px_18px_-6px_rgba(0,0,0,0.55)]`}
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                <Icon
                  className={`relative h-5 w-5 transition ${
                    active ? "text-white" : "text-white/55"
                  }`}
                  strokeWidth={active ? 2.4 : 2}
                />
                <span
                  className={`relative text-[10px] font-display tracking-wide leading-none
                              transition ${active ? "text-white" : "text-white/55"}`}
                >
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
