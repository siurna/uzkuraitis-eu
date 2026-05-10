"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// Bottom-sheet drawer, shared by NameGate, SettingsModal, CountryDrawer,
// and anything else that wants the same iOS-style slide-up overlay.
//
// Behaviour:
//   - Tap the backdrop to close (unless `dismissible={false}`).
//   - Esc closes too.
//   - Body scroll locked while the sheet is mounted.
//   - Drag handle + optional close button + title row are part of the
//     primitive so every sheet looks identical.
//
// Layout:
//   - max-h: 92vh, scroll inside.
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
        <motion.div
          key="bottom-sheet"
          className="fixed inset-0 z-50 flex flex-col justify-end"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <button
            type="button"
            aria-label="Close"
            onClick={dismissible ? onClose : undefined}
            disabled={!dismissible}
            className="absolute inset-0 bg-dark-blue-900/70 backdrop-blur-sm
                       disabled:cursor-default"
          />

          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="relative mx-auto w-full max-w-md
                       glass-card rounded-t-3xl border-x-0 border-b-0
                       max-h-[92vh] flex flex-col"
          >
            {/* Drag handle. Decorative; actual swipe-down isn't wired
                up because backdrop tap is the canonical dismiss path
                and most browsers won't propagate touch swipes through
                a position:fixed scrolling child correctly. */}
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
        </motion.div>
      )}
    </AnimatePresence>
  );
}
