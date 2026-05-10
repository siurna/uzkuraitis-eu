"use client";

import { motion } from "motion/react";
import { usePathname } from "next/navigation";

// Wrap a route's root element with this and it fades in on every
// navigation. Keyed on pathname so Next App Router triggers a fresh
// enter animation for each route, not just the initial mount.
//
// IMPORTANT: opacity-only — no y/scale/transform. Any transform on this
// wrapper would establish it as the containing block for descendant
// position:fixed elements (drawers, the heartbeat backdrop, the
// honeycomb presence) and they'd anchor to it instead of the viewport.
// The bottom-sheet ALSO portals into document.body as a belt-and-braces
// guard against this same class of bug.
export function PageTransition({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const pathname = usePathname();
  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
