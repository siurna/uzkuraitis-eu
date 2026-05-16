"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  Home,
  MessageCircle,
  Grid3x3,
  ListChecks,
  Trophy,
  type LucideProps,
} from "lucide-react";
import { t } from "@/lib/i18n";
import { useLang } from "@/lib/i18n-client";
import { useRoomLive, useRoomTab, type RoomTab } from "@/components/room-shell";
import { useRoomChrome } from "@/lib/use-room-chrome";
import { countryColors } from "@/lib/country-colors";

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
    // Was purple → fuchsia → flamingo, which collided with Home's
    // flamingo-fuchsia-orange. Bingo goes cool-leading now (purple →
    // blue → fuchsia) so the two tabs read as different palettes at a
    // glance — Home is warm pink-orange, Bingo is purple-blue with a
    // pink tail. Glow stays in the purple-electric range so it still
    // pops against the near-black dock.
    gradient: "from-purple via-blue to-fuchsia",
    glow: "shadow-[0_10px_28px_-3px_oklch(60%_0.24_278_/_0.78)]",
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
  const { tallyEnabled, nowPlayingCode } = useRoomLive();
  const active = TABS.find((t) => t.id === tab) ?? TABS[0];
  // SSR-safe portal mount. Same defensive pattern BottomSheet uses
  // (see CLAUDE.md). The tab bar is `position: fixed`, so any ancestor
  // that ever holds a `transform`/`filter`/`will-change: transform`
  // — motion-react mid-tween, a View Transitions snapshot during a
  // language swap, a backdrop-blur on the wrong wrapper, etc — will
  // re-anchor the bar to THAT ancestor's box and float it mid-page.
  // Portaling to body sidesteps the whole class of bug.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Same story as PresenceBar: the bar is portaled to document.body
  // so any wrapping <div className={...}> in room-shell never
  // reached this DOM node. The hide-on-mobile class has to be on the
  // bar itself, driven by the shared RoomChromeProvider.
  const { hidden: chromeHidden } = useRoomChrome();

  const bar = (
    <nav
      className={`uzk-edge-bar fixed bottom-0 left-0 z-40
                 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2
                 bg-gradient-to-t from-dark-blue-900 via-dark-blue-900/92 to-transparent
                 ${chromeHidden ? "max-md:hidden" : ""}`}
    >
      {/* Same container chrome as Home widgets + chat composer
          (container mx-auto max-w-3xl px-4) so the dock pill's left/right
          edges line up exactly with the cards stacked above it instead
          of fighting them with its own narrower width. */}
      <div className="container mx-auto max-w-3xl px-4">
      <ul
        className="flex items-stretch justify-around gap-1
                   rounded-[28px] bg-black/55 ring-1 ring-white/10 p-1.5 backdrop-blur-md"
      >
        {TABS.map(({ id, labelKey, Icon, gradient, glow }) => {
          const isActive = id === tab;
          // The "Vote" slot turns into "Results" the moment the host
          // reveals the score. Crossfade the icon + label so it reads
          // as the SAME tab transforming, not a navigation.
          const isResults = id === "vote" && tallyEnabled;
          const effectiveIcon = isResults ? Trophy : Icon;
          const effectiveLabelKey = (isResults ? "tab_results" : labelKey) as
            | "tab_home"
            | "tab_chat"
            | "tab_bingo"
            | "tab_vote"
            | "tab_results";
          const label = t(lang, effectiveLabelKey);
          const morphKey = `${id}-${isResults ? "results" : "default"}`;
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
                  (() => {
                    // Chat tab specifically: when a country is on stage,
                    // the base gradient itself animates from the brand
                    // turquoise→blue→purple wash INTO the country's
                    // flag-coloured wash (and the box-shadow tints to
                    // match). No overlay layer — the pill's background
                    // + boxShadow are inline style properties that
                    // motion interpolates as the values change. The
                    // 60% mix with dark-blue-900 keeps white text
                    // legible against any flag colour without
                    // per-country tuning. Other tabs keep their
                    // static Tailwind class gradient.
                    //
                    // Why `in oklab` and not `in oklch`: OKLCH
                    // interpolates HUE along the colour wheel via the
                    // shortest path. Yellow (#fae042, hue ~100°)
                    // mixed 60/40 with dark-blue-900 (hue ~262°)
                    // travels through GREEN (~164°) and lands looking
                    // teal — Belgium's "yellow + red" pill came out
                    // bright green. OKLAB interpolates the linear L/a/b
                    // axes instead, no hue-wheel walk, so the mixed
                    // colour keeps its source character (yellow stays
                    // yellow-olive, red stays dark-red).
                    const isChatWashed = id === "chat" && !!nowPlayingCode;
                    const [c1, c2] = isChatWashed
                      ? countryColors(nowPlayingCode!)
                      : ["", ""];
                    const chatBackground = isChatWashed
                      ? `linear-gradient(135deg, color-mix(in oklab, ${c1} 60%, var(--color-dark-blue-900)), color-mix(in oklab, ${c2} 60%, var(--color-dark-blue-900)))`
                      // Default chat-tab gradient as inline style, so
                      // the transition into the country wash is a
                      // smooth animation between two gradients of the
                      // same shape (browser can interpolate the
                      // colour stops) rather than a class swap.
                      : id === "chat"
                        ? "linear-gradient(135deg, var(--color-turquoise), var(--color-blue), var(--color-purple))"
                        : undefined;
                    const chatShadow = isChatWashed
                      ? `0 8px 22px -6px color-mix(in oklab, ${c1} 60%, var(--color-dark-blue-900))`
                      : undefined;
                    return (
                      <motion.span
                        layoutId="tab-pill"
                        className={`absolute inset-0 rounded-[22px] ${chatBackground ? "transition-[background,box-shadow] duration-[650ms] ease-out" : `bg-gradient-to-br ${gradient}`} ${chatBackground ? "" : glow}`}
                        style={
                          chatBackground
                            ? {
                                background: chatBackground,
                                boxShadow:
                                  chatShadow ??
                                  "0 8px 22px -6px oklch(78% 0.13 190 / 0.55)",
                              }
                            : undefined
                        }
                        transition={{ type: "spring", stiffness: 560, damping: 42 }}
                      />
                    );
                  })()
                )}
                <div className="relative h-6 w-6">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={morphKey}
                      initial={{ opacity: 0, scale: 0.8, rotate: -12 }}
                      animate={{ opacity: 1, scale: 1, rotate: 0 }}
                      exit={{ opacity: 0, scale: 0.8, rotate: 12 }}
                      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                      className="absolute inset-0"
                    >
                      {(() => {
                        const I = effectiveIcon;
                        return (
                          <I
                            className={`h-6 w-6 transition-colors ${
                              isActive ? "text-white" : "text-dark-blue-200"
                            }`}
                            strokeWidth={2}
                          />
                        );
                      })()}
                    </motion.span>
                  </AnimatePresence>
                  {/* Unread badge on the Chat tab. */}
                  {labelKey === "tab_chat" && chatUnread > 0 && (
                    <span className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] px-1
                                     rounded-full bg-fuchsia text-white text-[10px]
                                     font-display tabular-nums grid place-items-center
                                     ring-2 ring-black/55">
                      {chatUnread > 9 ? "9+" : chatUnread}
                    </span>
                  )}
                </div>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={`${morphKey}-label`}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.22 }}
                    className={`relative text-[10px] font-display tracking-wide leading-none
                                transition ${isActive ? "text-white" : "text-white/55"}`}
                  >
                    {label}
                  </motion.span>
                </AnimatePresence>
              </button>
            </li>
          );
        })}
      </ul>
      </div>
      {/* Hidden accessor for screen readers — reads the current tab
          gradient direction for completeness. */}
      <span hidden aria-hidden>{active?.gradient}</span>
    </nav>
  );

  if (!mounted || typeof document === "undefined") return null;
  return createPortal(bar, document.body);
}
