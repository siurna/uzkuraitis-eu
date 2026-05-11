"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";

// Fullscreen image viewer — tap anywhere or Esc to close. Portaled to
// <body> so it sits above the chat panel + tab dock.
export function Lightbox({
  url,
  onClose,
  closeLabel,
}: {
  url: string | null;
  onClose: () => void;
  closeLabel: string;
}) {
  useEffect(() => {
    if (!url) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [url, onClose]);
  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {url && (
        <motion.div
          className="fixed inset-0 z-[100] grid place-items-center bg-black/92 backdrop-blur-sm p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="absolute top-4 right-4 text-white/80 hover:text-white p-2"
          >
            <X className="h-6 w-6" />
          </button>
          <motion.img
            src={url}
            alt=""
            initial={{ scale: 0.94 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.94 }}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] max-w-[95vw] object-contain rounded-xl"
          />
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
