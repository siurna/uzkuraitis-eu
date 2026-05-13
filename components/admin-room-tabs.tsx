"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Activity, Users, Settings } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

// Tabbed shell for the admin room detail page. Server-side renders the
// full data per tab; this client component owns the active-tab state
// and the slide animation. (Live show controls live on /admin/live,
// not here — those are global, not per-room. The danger zone lives at
// the bottom of Settings.)
export type TabId = "overview" | "voters" | "settings";

const TAB_DEFS: { id: TabId; label: string; Icon: typeof Activity }[] = [
  { id: "overview", label: "Overview", Icon: Activity },
  { id: "voters",   label: "Voters",   Icon: Users },
  { id: "settings", label: "Settings", Icon: Settings },
];

export function AdminRoomTabs({
  overview,
  voters,
  settings,
}: {
  overview: React.ReactNode;
  voters: React.ReactNode;
  settings: React.ReactNode;
}) {
  const [active, setActive] = useState<TabId>("overview");
  const panels: Record<TabId, React.ReactNode> = {
    overview,
    voters,
    settings,
  };

  return (
    <Tabs value={active} onValueChange={(v) => setActive(v as TabId)}>
      <TabsList className="overflow-x-auto max-w-full">
        {TAB_DEFS.map(({ id, label, Icon }) => (
          <TabsTrigger key={id} value={id} className="px-3">
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden text-xs">{label.charAt(0)}</span>
          </TabsTrigger>
        ))}
      </TabsList>

      <div className="mt-6">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col gap-6"
          >
            <TabsContent value={active} forceMount>
              {panels[active]}
            </TabsContent>
          </motion.div>
        </AnimatePresence>
      </div>
    </Tabs>
  );
}
