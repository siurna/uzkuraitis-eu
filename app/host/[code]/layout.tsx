import type { ReactNode } from "react";

// /host/[code]/* lives OUTSIDE the room shell on purpose: the magic-
// link host page is admin chrome, not the watch-along UI. No NameGate,
// no PresenceBar, no tab bar, no NowPlayingTakeover — just a plain
// page container that mirrors the /admin/* visual language so the
// host's surface feels like the same backstage tool as the global
// admin.
export default function HostLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col">
      <main className="flex-1 container mx-auto max-w-3xl px-4 py-8">
        {children}
      </main>
    </div>
  );
}
