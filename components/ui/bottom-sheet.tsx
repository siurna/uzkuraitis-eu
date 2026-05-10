"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// Bottom-sheet drawer, shared by NameGate, SettingsModal, CountryDrawer,
// and anything else that wants the same iOS-style slide-up overlay.
//
// Layout decisions:
//   - The sheet is `fixed bottom-0` directly (not flex-justify-end on a
//     fixed inset-0 wrapper). The wrapper-flex pattern broke on iOS when
//     the URL bar transitioned: the sheet briefly animated above the
//     viewport because translateY% was being computed against an
//     unstable parent height.
//   - max-h: 92dvh (dynamic viewport height) so the sheet shrinks
//     correctly on iOS Safari with the URL bar visible.
//   - Backdrop is a separate fixed element so the two can animate
//     independently and the sheet's transform stays predictable.
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

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            key="backdrop"
            type="button"
            aria-label="Close"
            onClick={dismissible ? onClose : undefined}
            disabled={!dismissible}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 bg-dark-blue-900/70 backdrop-blur-sm
                       disabled:cursor-default"
          />
          <motion.div
            key="sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="fixed bottom-0 inset-x-0 z-50 mx-auto w-full max-w-md
                       glass-card rounded-t-3xl border-x-0 border-b-0
                       max-h-[92dvh] flex flex-col
                       pb-[env(safe-area-inset-bottom)]"
          >
            {/* Drag handle. Decorative; swipe-to-dismiss isn't wired up
                because backdrop tap is the canonical dismiss path and
                touch swipes inside a scrolling child don't bubble
                reliably across browsers. */}
            <div className="flex justify-center pt-2 pb-1 shrink-0">
              <div className="h-1 w-10 rounded-full bg-white/20" />
            </div>

            {(title || sub || dismissible) && (
              <div className="px-5 pb-3 flex items-start gap-3 shrink-0">
                <div className="flex-1 min-w-0">
                  {title && (
                    <h2 className="font-display text-xl gradient-text">
                      {title}
                    </h2>
                  )}
                  {sub && (
                    <p className="text-xs text-white/55 mt-1 leading-relaxed">
                      {sub}
                    </p>
                  )}
                </div>
                {dismissible && (
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="text-white/50 hover:text-white p-1 -m-1 transition"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>
            )}

            <div
              className={cn(
                // pt-2 keeps focus rings on the first form field from
                // getting clipped at the scroll viewport's top edge.
                "flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 pt-2 pb-5 flex flex-col gap-4",
                contentClassName,
              )}
            >
              {children}
            </div>

            {footer && (
              <div className="px-5 py-3 border-t border-white/5 shrink-0 flex items-center gap-3">
                {footer}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
