"use client";

import { motion } from "motion/react";
import { usePathname } from "next/navigation";

// Wrap a route's root element with this and it fades + lifts in on
// every navigation. Keyed on pathname so Next App Router triggers a
// fresh enter animation for each route, not just the initial mount.
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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
