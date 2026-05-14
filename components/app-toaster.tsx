"use client";

import { Toaster } from "sonner";
import { FluentEmoji } from "@/components/fluent-emoji";

// User-facing in-app notifications. Sits at the top of the viewport so
// a thumb-driven user reads it the same way they read a push banner —
// not down by the chat composer where it'd cover the keyboard. Three
// visual targets:
//
//   - Massive rounded corners (28px) so the toast reads as a soft chip,
//     not a system rectangle. Pairs with the app's iOS-style 40px
//     sheet radius.
//   - Themed Fluent 3D emoji per toast type instead of sonner's
//     stroked check / cross. Same emoji language the rest of the app
//     speaks (`<FluentEmoji/>` everywhere else).
//   - Glass-card surface (dark navy with a coloured ring per type)
//     so the toast reads as a piece of THIS app on top of any
//     background, not sonner's default white-on-dark.
//
// `mobileOffset` pushes the toast below the iOS status bar / notch
// (env(safe-area-inset-top) lives there). `offset` is the desktop
// fallback. Toasts are dismissable with a swipe up.
export function AppToaster() {
  return (
    <Toaster
      theme="dark"
      position="top-center"
      offset={20}
      mobileOffset={{ top: "max(env(safe-area-inset-top), 14px)" }}
      gap={10}
      visibleToasts={3}
      icons={{
        success: <FluentEmoji glyph="🎉" size={26} />,
        error: <FluentEmoji glyph="❗" size={26} />,
        warning: <FluentEmoji glyph="⚠️" size={26} />,
        info: <FluentEmoji glyph="💡" size={26} />,
      }}
      toastOptions={{
        // Inline style wins over sonner's own per-toast inline style.
        // Tailwind v4 important-prefix on classNames is fiddly with
        // sonner's existing styles, so we drive the chip's look from
        // here and reserve `classNames` for typography helpers.
        style: {
          borderRadius: "28px",
          padding: "14px 18px",
          minHeight: "56px",
          background:
            "linear-gradient(135deg, oklch(22% 0.08 264 / 0.95), oklch(18% 0.08 280 / 0.95))",
          border: "1px solid oklch(100% 0 0 / 0.12)",
          boxShadow:
            "0 18px 44px -18px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)",
          backdropFilter: "blur(8px)",
          color: "white",
          fontFamily: "var(--font-display)",
          fontSize: "15px",
          lineHeight: "1.35",
        },
        classNames: {
          title: "font-display",
          description: "text-sm text-white/70",
          // Icon slot: square, locked size, plus a small right-side
          // breathing gap so the 3D PNG isn't kissing the toast
          // body copy.
          icon: "shrink-0 mr-1.5",
        },
      }}
    />
  );
}
