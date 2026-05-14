"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";
import { useLang } from "@/lib/i18n-client";

// Bottom-sheet drawer, shared by NameGate, SettingsModal, CountryDrawer,
// and anything else that wants the same iOS-style slide-up overlay.
//
// IMPORTANT: rendered via createPortal into document.body. Without that,
// any ancestor with a CSS transform (e.g. the PageTransition motion.div
// wrapping the whole app) becomes the containing block for our
// position:fixed elements, and the sheet anchors to that wrapper
// instead of the viewport — visually cutting off below the viewport
// bottom on certain layouts.
//
// Layout decisions:
//   - The sheet is `fixed bottom-0` directly. Backdrop is its own
//     fixed element so the two animate independently and the sheet's
//     transform stays predictable.
//   - max-h: 92dvh (dynamic viewport height) so the sheet shrinks
//     correctly on iOS Safari with the URL bar visible.
//   - Centre column at max-w-md so it reads well on tablets/desktops.

export function BottomSheet({
  open,
  onClose,
  title,
  sub,
  children,
  footer,
  dismissible = true,
  contentClassName,
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  sub?: React.ReactNode;
  children: React.ReactNode;
  /** Sticky bottom row; e.g. confirm/cancel buttons. */
  footer?: React.ReactNode;
  /** When false, the backdrop + Esc are inert. Default true. */
  dismissible?: boolean;
  contentClassName?: string;
}) {
  const lang = useLang();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (!dismissible) return () => void (document.body.style.overflow = prev);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, dismissible, onClose]);

  const sheet = (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            key="backdrop"
            type="button"
            aria-label={t(lang, "close")}
            onClick={dismissible ? onClose : undefined}
            disabled={!dismissible}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[60] bg-dark-blue-900/70 backdrop-blur-sm
                       disabled:cursor-default"
          />
          <motion.div
            key="sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            // Edge-to-edge on mobile (the sheet hugs the bottom flush so
            // the home indicator sits over its own background, not a
            // gap), centred at max-w-md on tablets/desktops. Rounded
            // only at the top.
            // `uzk-sheet-ios-radius` (globals.css) bumps the top
            // corners to 40px when display-mode is browser — matches
            // iOS Safari's native sheet feel — and stays at the
            // Tailwind default (24px / rounded-3xl) in PWA / desktop.
            className="fixed bottom-0 inset-x-0 z-[60] mx-auto w-full max-w-md
                       glass-card rounded-t-3xl uzk-sheet-ios-radius
                       border-x-0 border-b-0
                       max-h-[78dvh] flex flex-col"
          >
            {(title || sub || dismissible) && (
              <div className="px-5 pt-5 pb-2 flex items-center gap-3 shrink-0">
                <div className="flex-1 min-w-0">
                  {title && (
                    <h2 className="font-display text-3xl sm:text-[2rem] leading-tight gradient-text text-balance">
                      {title}
                    </h2>
                  )}
                  {sub && (
                    <p className="text-sm text-white/55 leading-snug text-pretty mt-0.5">
                      {sub}
                    </p>
                  )}
                </div>
                {dismissible && (
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label={t(lang, "close")}
                    className="text-white/50 hover:text-white p-1 -m-1 transition shrink-0 self-center"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>
            )}

            <div
              className={cn(
                // The sheet hugs its content: when everything fits
                // within max-h, no scrollbar appears + the sheet
                // shrinks to the natural height of the children.
                // Overflow only kicks in once the content exceeds
                // the sheet's max-h (78dvh, set on the parent).
                // pt-3 keeps focus rings on the first form field
                // from getting clipped at the scroll viewport's top
                // edge; fade-scroll-y softens the edges when the
                // content does spill.
                "min-h-0 overflow-y-auto overscroll-contain px-5 pt-3 flex flex-col gap-4 fade-scroll-y",
                "pb-[max(env(safe-area-inset-bottom),1.25rem)]",
                contentClassName,
              )}
            >
              {children}
            </div>

            {footer && (
              <div className="px-5 py-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]
                              border-t border-white/5 shrink-0 flex items-center gap-3">
                {footer}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  if (!mounted || typeof document === "undefined") return null;
  return createPortal(sheet, document.body);
}
