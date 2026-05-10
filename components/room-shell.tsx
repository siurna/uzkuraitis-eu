"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { RoomProvider, useEventListener } from "@/lib/liveblocks";
import { Button } from "@/components/ui/button";
import { Standings } from "@/components/standings";
import { FloatingReactionsLayer } from "@/components/floating-reactions";
import { PresenceBar } from "@/components/presence-bar";
import { HoneycombPresence } from "@/components/honeycomb-presence";
import { NameGate } from "@/components/name-gate";
import { useLang, t } from "@/lib/i18n";

const LAST_ROOM_KEY = "uzk_last_room";

// Live-room context: holds the props that can change at runtime
// (votingEnabled, name) so any descendant can subscribe without
// prop-drilling. Refreshed on every "room:updated" Liveblocks
// broadcast plus on initial mount.
type RoomLive = {
  code: string;
  name: string;
  votingEnabled: boolean;
};

const RoomLiveContext = createContext<RoomLive | null>(null);

export function useRoomLive(): RoomLive {
  const ctx = useContext(RoomLiveContext);
  if (!ctx) throw new Error("useRoomLive must be used inside <RoomShell>");
  return ctx;
}

export function RoomShell({
  code,
  name,
  votingEnabled,
}: {
  code: string;
  name: string;
  votingEnabled: boolean;
}) {
  useEffect(() => {
    localStorage.setItem(LAST_ROOM_KEY, code);
  }, [code]);

  return (
    <RoomProvider
      id={`room:${code}`}
      initialPresence={{ name: null, avatar: null, emoji: null, hoveredCountry: null }}
    >
      <NameGate>
        <RoomLiveProvider initial={{ code, name, votingEnabled }}>
          <div className="min-h-screen flex flex-col pb-32 sm:pb-32">
            <PresenceBar />
            <Standings />
            <FloatingReactionsWithLive code={code} />
            <HoneycombPresence />
            <MobileVoteCta />
          </div>
        </RoomLiveProvider>
      </NameGate>
    </RoomProvider>
  );
}

// Wrapper that reads votingEnabled from context and tells the reaction
// layer to drop its bottom bar on mobile while voting is live.
function FloatingReactionsWithLive({ code }: { code: string }) {
  const { votingEnabled } = useRoomLive();
  return <FloatingReactionsLayer code={code} hideBarOnMobile={votingEnabled} />;
}

// Sticky bottom CTA, mobile only. Replaces the floating emoji bar on
// mobile while voting is open so the cast-vote action sits where the
// thumb naturally rests. Desktop keeps the inline CTA in <Standings>.
function MobileVoteCta() {
  const { code, votingEnabled } = useRoomLive();
  const lang = useLang();
  const [hasVoted, setHasVoted] = useState(false);

  useEffect(() => {
    setHasVoted(localStorage.getItem(`uzk_voted_${code}`) === "1");
  }, [code]);

  return (
    <AnimatePresence>
      {votingEnabled && (
        <motion.div
          key="mobile-cta"
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 28 }}
          className="sm:hidden fixed bottom-0 inset-x-0 z-40 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3
                     bg-gradient-to-t from-dark-blue-900 via-dark-blue-900/85 to-transparent"
        >
          <Link href={`/r/${code}/vote`} className="rainbow-border rounded-2xl block">
            <Button
              className="w-full h-14 text-base font-display rounded-[14px]
                         bg-white text-dark-blue hover:bg-dark-blue-50"
            >
              {hasVoted ? t(lang, "update_vote") : t(lang, "cast_vote")}
            </Button>
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Refetches /api/rooms/[code] whenever a "room:updated" broadcast arrives
// and pushes the latest props down through context.
function RoomLiveProvider({
  initial,
  children,
}: {
  initial: RoomLive;
  children: React.ReactNode;
}) {
  const [state, setState] = useState<RoomLive>(initial);

  const refetch = useCallback(async () => {
    try {
      const res = await fetch(`/api/rooms/${initial.code}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        code: string;
        name: string;
        votingEnabled: boolean;
      };
      setState({
        code: data.code,
        name: data.name,
        votingEnabled: data.votingEnabled,
      });
    } catch {
      /* network blips don't kill us */
    }
  }, [initial.code]);

  useEventListener(({ event }) => {
    if ((event as { type?: string }).type === "room:updated") refetch();
  });

  return (
    <RoomLiveContext.Provider value={state}>{children}</RoomLiveContext.Provider>
  );
}
