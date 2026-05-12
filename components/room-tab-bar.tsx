"use client";

import { motion } from "motion/react";
import {
  Home,
  MessageCircle,
  Grid3x3,
  ListChecks,
  type LucideProps,
} from "lucide-react";
import { useLang, t } from "@/lib/i18n";
import { useRoomTab, type RoomTab } from "@/components/room-shell";

// Bottom dock. Each tab switches the room's active panel in place —
// pure state, no navigation. The active pill layoutId-animates between
// tabs. Brand-gradient active state per tab so the dock itself reads as
// ESC-coloured rather than monochrome white.
type TabDef = {
  id: RoomTab;
  labelKey: "tab_home" | "tab_chat" | "tab_bingo" | "tab_vote";
  Icon: React.ComponentType<LucideProps>;
  /** Tailwind gradient classes for the active pill bg. */
  gradient: string;
  /** Glow colour applied to the active icon's drop-shadow + the pill ring. */
  glow: string;
};

const TABS: TabDef[] = [
  {
    id: "home",
    labelKey: "tab_home",
    Icon: Home,
    gradient: "from-flamingo via-fuchsia to-orange",
    glow: "shadow-[0_8px_22px_-6px_oklch(70%_0.27_336_/_0.65)]",
  },
  {
    id: "chat",
    labelKey: "tab_chat",
    Icon: MessageCircle,
    gradient: "from-turquoise via-blue to-purple",
    glow: "shadow-[0_8px_22px_-6px_oklch(78%_0.13_190_/_0.55)]",
  },
  {
    id: "bingo",
    labelKey: "tab_bingo",
    Icon: Grid3x3,
    gradient: "from-purple via-fuchsia to-flamingo",
    glow: "shadow-[0_8px_22px_-6px_oklch(42%_0.20_295_/_0.65)]",
  },
  {
    id: "vote",
    labelKey: "tab_vote",
    Icon: ListChecks,
    gradient: "from-yellow via-orange to-fuchsia",
    glow: "shadow-[0_8px_22px_-6px_oklch(95%_0.19_108_/_0.55)]",
  },
];

export function RoomTabBar({ chatUnread = 0 }: { chatUnread?: number }) {
  const lang = useLang();
  const { tab, setTab } = useRoomTab();
  const active = TABS.find((t) => t.id === tab) ?? TABS[0];

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
        {TABS.map(({ id, labelKey, Icon, gradient, glow }) => {
          const isActive = id === tab;
          const label = t(lang, labelKey);
          return (
            <li key={id} className="flex-1">
              <button
                type="button"
                onClick={() => setTab(id)}
                aria-label={label}
                aria-current={isActive ? "page" : undefined}
                className="relative w-full flex flex-col items-center justify-center gap-1
                           py-2 rounded-[22px]"
              >
                {isActive && (
                  <motion.span
                    layoutId="tab-pill"
                    className={`absolute inset-0 rounded-[22px] bg-gradient-to-br ${gradient} ${glow}`}
                    transition={{ type: "spring", stiffness: 560, damping: 42 }}
                  />
                )}
                <motion.div
                  initial={false}
                  animate={{ scale: isActive ? 1.06 : 1 }}
                  transition={{ type: "spring", stiffness: 560, damping: 34 }}
                  className="relative"
                >
                  <Icon
                    className={`h-6 w-6 transition ${
                      // Solid dim colour, not white/55 — opacity makes the
                      // overlapping strokes composite darker and look messy.
                      isActive ? "text-white" : "text-dark-blue-200"
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
              </button>
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
