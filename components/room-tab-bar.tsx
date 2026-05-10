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
import { useLang, t } from "@/lib/i18n";

// LinkProps is generic over the route. We don't care which specific
// route a TabDef points at — typedRoutes verifies each call site. Use
// a structural shape that matches Next's `LinkProps["href"]`.
type Href = React.ComponentProps<typeof Link>["href"];

// Bottom-fixed nav on mobile, sticky-top on desktop. Apple-Watch-style
// circular icons with a quiet selected state (white bg, dark-blue icon).
// Tabs are routes so deep links + browser back work natively.
type TabDef = {
  href: (code: string) => Href;
  label: (lang: "en" | "lt") => string;
  Icon: React.ComponentType<LucideProps>;
  bg: string;
  match: (pathname: string, code: string) => boolean;
};

// Typed-routes wants compile-time route strings; pathname includes the
// resolved code so we can build static-typed hrefs by passing `code` as
// a dynamic-segment param.
const TABS: TabDef[] = [
  {
    href: (code) => ({ pathname: "/r/[code]", params: { code } }),
    label: (lang) => t(lang, "tab_home"),
    Icon: Home,
    bg: "bg-[#0a84ff]",
    match: (p, code) => p === `/r/${code}`,
  },
  {
    href: (code) => ({ pathname: "/r/[code]/chat", params: { code } }),
    label: (lang) => t(lang, "tab_chat"),
    Icon: MessageCircle,
    bg: "bg-[#30d158]",
    match: (p, code) => p.startsWith(`/r/${code}/chat`),
  },
  {
    href: (code) => ({ pathname: "/r/[code]/bingo", params: { code } }),
    label: (lang) => t(lang, "tab_bingo"),
    Icon: Grid3x3,
    bg: "bg-[#bf5af2]",
    match: (p, code) => p.startsWith(`/r/${code}/bingo`),
  },
  {
    href: (code) => ({ pathname: "/r/[code]/vote", params: { code } }),
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
