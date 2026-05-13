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
export type TabId = "overview" | "participants" | "settings";

const TAB_DEFS: { id: TabId; label: string; Icon: typeof Activity }[] = [
  { id: "overview",     label: "Overview",     Icon: Activity },
  { id: "participants", label: "Participants", Icon: Users },
  { id: "settings",     label: "Settings",     Icon: Settings },
];

export function AdminRoomTabs({
  overview,
  participants,
  settings,
  participantCount,
}: {
  overview: React.ReactNode;
  participants: React.ReactNode;
  settings: React.ReactNode;
  /** Shown as a chip on the Participants tab so the headcount reads at a glance. */
  participantCount?: number;
}) {
  const [active, setActive] = useState<TabId>("overview");
  const panels: Record<TabId, React.ReactNode> = {
    overview,
    participants,
    settings,
  };

  return (
    <Tabs value={active} onValueChange={(v) => setActive(v as TabId)}>
      <TabsList className="overflow-x-auto max-w-full">
        {TAB_DEFS.map(({ id, label, Icon }) => (
          <TabsTrigger key={id} value={id} className="group px-3 gap-1.5">
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden text-xs">{label.charAt(0)}</span>
            {id === "participants" && participantCount != null && participantCount > 0 && (
              // When the tab is inactive the badge sits on a dim glass
              // pill (flamingo on flamingo/20). When it's active the
              // pill goes solid flamingo, so the badge has to flip to a
              // light-on-flamingo treatment to stay readable.
              <span
                className="inline-flex items-center justify-center rounded-full px-1.5 h-5 min-w-[1.25rem]
                           text-[10px] font-display tabular-nums
                           bg-flamingo/20 ring-1 ring-flamingo/35 text-flamingo
                           group-data-[state=active]:bg-white/25
                           group-data-[state=active]:ring-white/40
                           group-data-[state=active]:text-white"
              >
                {participantCount}
              </span>
            )}
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
