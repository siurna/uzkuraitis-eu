"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Activity, Users, Settings, AlertTriangle } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

// Tabbed shell for the admin room detail page. Server-side renders the
// full data per tab; this client component owns the active-tab state
// and the slide animation. Keep it dumb — tab content comes in as
// children panels, indexed by id.
export type TabId = "overview" | "voters" | "settings" | "danger";

const TAB_DEFS: { id: TabId; label: string; Icon: typeof Activity }[] = [
  { id: "overview", label: "Overview", Icon: Activity },
  { id: "voters",   label: "Voters",   Icon: Users },
  { id: "settings", label: "Settings", Icon: Settings },
  { id: "danger",   label: "Danger",   Icon: AlertTriangle },
];

export function AdminRoomTabs({
  overview,
  voters,
  settings,
  danger,
}: {
  overview: React.ReactNode;
  voters: React.ReactNode;
  settings: React.ReactNode;
  danger: React.ReactNode;
}) {
  const [active, setActive] = useState<TabId>("overview");
  const panels: Record<TabId, React.ReactNode> = {
    overview,
    voters,
    settings,
    danger,
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
