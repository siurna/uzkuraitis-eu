"use client";

import { useEffect } from "react";
import { isRoomTab, useRoomTab } from "@/components/room-shell";

// Bridges a server-rendered ?tab= search param into the client tab
// state on first mount. Renders nothing. (RoomBody also reads the same
// param itself, so this is mostly a belt-and-braces hook for the case
// where the param changes between client navigations to this page.)
export function TabSync({ tab }: { tab?: string }) {
  const { setTab } = useRoomTab();
  useEffect(() => {
    if (isRoomTab(tab) && tab !== "home") setTab(tab);
  }, [tab, setTab]);
  return null;
}
