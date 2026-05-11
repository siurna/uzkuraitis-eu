"use client";

import { motion } from "motion/react";

// Light page wrapper: a single fade-in on first mount only.
//
// NOT keyed on pathname — keying it would remount the whole subtree on
// every navigation, including any shared layout below it (the room
// shell + its sticky header + tab bar), making the chrome re-animate
// on every tab switch. We just want a gentle initial fade.
//
// Opacity-only — no transform. Any transform here would establish it as
// the containing block for descendant position:fixed elements
// (drawers, heartbeat backdrop, honeycomb) and they'd anchor to it
// instead of the viewport. (The bottom-sheet also portals to body as a
// belt-and-braces guard against that.)
export function PageTransition({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
