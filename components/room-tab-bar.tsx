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

// Bottom-fixed nav on mobile. Apple-Watch-style circular icons with a
// quiet selected state — active tab gets a coloured pill that
// layoutId-animates between tabs. Tabs are real routes so deep links
// + browser back work natively.
//
// hrefs are template-literal strings cast to Route — Next's typedRoutes
// validates the prefix; the trailing dynamic segment is fine to
// interpolate at runtime. The earlier UrlObject + params shape didn't
// substitute and rendered "/r/[code]" literally in the address bar.
type TabDef = {
  href: (code: string) => Route;
  label: (lang: "en" | "lt") => string;
  Icon: React.ComponentType<LucideProps>;
  bg: string;
  match: (pathname: string, code: string) => boolean;
};

const TABS: TabDef[] = [
  {
    href: (code) => `/r/${code}` as Route,
    label: (lang) => t(lang, "tab_home"),
    Icon: Home,
    bg: "bg-[#0a84ff]",
    match: (p, code) => p === `/r/${code}`,
  },
  {
    href: (code) => `/r/${code}/chat` as Route,
    label: (lang) => t(lang, "tab_chat"),
    Icon: MessageCircle,
    bg: "bg-[#30d158]",
    match: (p, code) => p.startsWith(`/r/${code}/chat`),
  },
  {
    href: (code) => `/r/${code}/bingo` as Route,
    label: (lang) => t(lang, "tab_bingo"),
    Icon: Grid3x3,
    bg: "bg-[#bf5af2]",
    match: (p, code) => p.startsWith(`/r/${code}/bingo`),
  },
  {
    href: (code) => `/r/${code}/vote` as Route,
    label: (lang) => t(lang, "tab_vote"),
    Icon: Vote,
    bg: "bg-[#ff2d55]",
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
                 bg-gradient-to-t from-dark-blue-900 via-dark-blue-900/85 to-transparent"
    >
      <ul
        className="mx-auto max-w-md flex items-center justify-around
                   rounded-full bg-black/40 ring-1 ring-white/10 p-1.5 backdrop-blur-md"
      >
        {TABS.map(({ href, label, Icon, bg, match }, i) => {
          const active = match(pathname, code);
          return (
            <li key={i}>
              <Link
                href={href(code)}
                aria-label={label(lang)}
                aria-current={active ? "page" : undefined}
                className="relative grid place-items-center h-11 w-11"
              >
                {active && (
                  <motion.span
                    layoutId="tab-pill"
                    className={`absolute inset-0 rounded-full ${bg}
                                shadow-[0_4px_14px_-4px_rgba(0,0,0,0.55)]`}
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                <Icon
                  className={`relative h-5 w-5 transition ${
                    active ? "text-white" : "text-white/55"
                  }`}
                  strokeWidth={active ? 2.4 : 2}
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
