"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { motion } from "motion/react";
import { Loader2, Megaphone, Vote, Trophy, ChevronRight } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { TogglePill } from "@/components/ui/toggle-pill";
import { AdminRoomTriviaThreshold } from "@/components/admin-room-trivia-threshold";
import { AdminRoomHighlightThreshold } from "@/components/admin-room-highlight-threshold";
import { timeAgo } from "@/lib/utils";

// Unified Live-room controls: one "Controls" CTA on the page that
// opens a bottom-sheet containing every per-room action the host
// could fire — voting/results switches up top, every broadcast shot
// listed below. Replaces the earlier stack of standalone tile cards
// + the dedicated AdminBroadcasts panel; per-row icons + titles +
// subtitles are gone, the drawer's compact rows speak for themselves.

type BroadcastKind =
  | "welcome"
  | "notifications"
  | "vote"
  | "bet"
  | "selfie"
  | "drunk_poll"
  | "top3"
  | "final"
  | "thanks";

const ROOM_BROADCAST_KEY = (room: string, kind: BroadcastKind) =>
  `uzk_broadcast_${room}_${kind}`;

// Compact broadcast list — title + one-line sub, no icon. Order is
// "soft → loud": welcome first, then the routine nudges, then the
// hype moments, then the final reveal.
const SHOTS: { kind: BroadcastKind; title: string; desc: string }[] = [
  { kind: "welcome",       title: "Hello folks",          desc: "Drops your housekeeping notes." },
  { kind: "notifications", title: "Turn on notifications", desc: "Nudge to enable push." },
  { kind: "vote",          title: "Lines are open",       desc: "Lock in your TOP 10." },
  { kind: "bet",           title: "Don't forget bonus bets", desc: "Free points if you call them." },
  { kind: "selfie",        title: "Selfie time",          desc: "Polaroid prompt into chat." },
  { kind: "drunk_poll",    title: "How drunk are you?",   desc: "Vibe-check tally bar." },
  { kind: "top3",          title: "Top 3 right now",      desc: "Live fan-aggregate podium." },
  { kind: "final",         title: "Final results",        desc: "Scored leaderboard." },
  { kind: "thanks",        title: "Thank you, Europe",    desc: "Closing card with confetti." },
];

export function AdminLiveControls({
  rooms,
  room,
  initialVoting,
  initialTally,
  initialTriviaCap,
  initialHighlightThreshold,
}: {
  rooms: { code: string; name: string }[];
  room: string;
  initialVoting: boolean;
  initialTally: boolean;
  initialTriviaCap: number | null;
  initialHighlightThreshold: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [voting, setVoting] = useState(initialVoting);
  const [tally, setTally] = useState(initialTally);
  const [pending, start] = useTransition();
  const [busyShot, setBusyShot] = useState<BroadcastKind | null>(null);
  const [lastFired, setLastFired] = useState<Partial<Record<BroadcastKind, string>>>({});

  // Pull the per-room "when did I last fire X" log from localStorage
  // so the drawer can show a small "fired 2 min ago" footer per row.
  useEffect(() => {
    if (!room) {
      setLastFired({});
      return;
    }
    const next: Partial<Record<BroadcastKind, string>> = {};
    for (const { kind } of SHOTS) {
      const v = localStorage.getItem(ROOM_BROADCAST_KEY(room, kind));
      if (v) next[kind] = v;
    }
    setLastFired(next);
  }, [room]);

  // Keep state in sync when the room changes underneath us (the
  // parent column passes the new room's voting/tally flags down).
  useEffect(() => {
    setVoting(initialVoting);
    setTally(initialTally);
  }, [initialVoting, initialTally]);

  const fireBroadcast = async (kind: BroadcastKind) => {
    if (!room) {
      toast.error("Pick a room first.");
      return;
    }
    setBusyShot(kind);
    try {
      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ room, kind }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        toast.error(data.error ?? "Couldn't post that.");
        return;
      }
      toast.success(`Posted to ${room}.`);
      const now = new Date().toISOString();
      try {
        localStorage.setItem(ROOM_BROADCAST_KEY(room, kind), now);
      } catch {
        /* ignore */
      }
      setLastFired((prev) => ({ ...prev, [kind]: now }));
    } catch {
      toast.error("Couldn't post that (network).");
    } finally {
      setBusyShot(null);
    }
  };

  const flipVoting = () => {
    if (!room) return;
    start(async () => {
      const next = !voting;
      const res = await fetch(`/api/admin/rooms/${room}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ votingEnabled: next }),
      });
      if (!res.ok) {
        toast.error("Couldn't update the room.");
        return;
      }
      setVoting(next);
      // When voting flips ON, offer to also post the "lines are
      // open" CTA into chat — the host almost always wants both
      // signals, but they should still get a confirm so we don't
      // double-fire on a re-tap.
      if (next) {
        toast.success("Voting opened", {
          description: "Also drop the 'lines are open' card into chat?",
          action: {
            label: "Post it",
            onClick: () => fireBroadcast("vote"),
          },
          duration: 8000,
        });
      } else {
        toast.success("Voting closed");
      }
    });
  };

  const flipTally = () => {
    if (!room) return;
    start(async () => {
      const next = !tally;
      const res = await fetch(`/api/admin/rooms/${room}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tallyEnabled: next }),
      });
      if (!res.ok) {
        toast.error("Couldn't update the room.");
        return;
      }
      setTally(next);
      toast.success(next ? "Results revealed" : "Results hidden");
    });
  };

  const noRoom = rooms.length === 0 || !room;

  return (
    <>
      {/* Voting + results switches live on the page itself now — they
          carry the most weight (lines open / scoreboard reveal) and
          should be one tap away, not behind a drawer. Only the
          broadcasts (selfie / poll / hype shots) hide in the drawer. */}
      <div className="flex flex-col gap-2">
        <DrawerSwitch
          icon={<Vote className="h-4 w-4" />}
          label="Voting open"
          on={voting}
          disabled={pending || noRoom}
          onChange={flipVoting}
        />
        <DrawerSwitch
          icon={<Trophy className="h-4 w-4" />}
          label="Reveal results"
          on={tally}
          disabled={pending || noRoom}
          onChange={flipTally}
        />
        {/* Trivia + highlight caps live on the page too, under the
            voting/results switches. They're the same per-room knobs
            you'd otherwise hunt down in /admin/rooms/[code]: trivia
            caps how many players can lock an answer per question,
            highlight threshold is the reaction count needed for a
            chat message to count as a "highlight" (bonus points +
            badge). Re-keyed by `room` so swapping room in the picker
            remounts the cards with fresh initial values, otherwise
            you'd see stale numbers from the previous selection. */}
        {!noRoom && (
          <>
            <AdminRoomTriviaThreshold
              key={`trivia-${room}`}
              code={room}
              initialMax={initialTriviaCap}
            />
            <AdminRoomHighlightThreshold
              key={`highlight-${room}`}
              code={room}
              initialThreshold={initialHighlightThreshold ?? 5}
            />
          </>
        )}
      </div>

      {/* Sized to match the DrawerSwitch + threshold rows above:
          h-8 icon tile, px-3 py-2.5 padding, font-display text-sm
          label. Rainbow border keeps it visually distinct as the
          "the show happens here" CTA without dwarfing the other
          row controls. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={noRoom}
        className="rainbow-border rounded-xl w-full block disabled:opacity-40"
      >
        <span className="block w-full rounded-[10px] bg-gradient-to-br from-dark-blue-800 to-dark-blue-900
                         px-3 py-2.5 flex items-center gap-3 text-left">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-flamingo/20 ring-1 ring-flamingo/40 text-flamingo">
            <Megaphone className="h-4 w-4" />
          </span>
          <span className="flex-1 font-display text-sm text-white">
            {noRoom ? "Broadcasts — pick a room first" : "Broadcasts"}
          </span>
          <ChevronRight className="h-4 w-4 text-white/55 shrink-0" />
        </span>
      </button>

      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Broadcasts"
        sub={room || "No room selected"}
      >
        <ul className="flex flex-col gap-1">
          {SHOTS.map(({ kind, title, desc }) => {
            const last = lastFired[kind];
            const sending = busyShot === kind;
            return (
              <li key={kind}>
                <button
                  type="button"
                  onClick={() => fireBroadcast(kind)}
                  disabled={busyShot !== null}
                  className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5
                             bg-white/[0.03] ring-1 ring-white/8 hover:bg-white/[0.06] transition text-left
                             disabled:opacity-60"
                >
                  <span className="flex-1 min-w-0">
                    <span className="block font-display text-sm text-white truncate">{title}</span>
                    <span className="block text-[11px] text-white/50 leading-snug">{desc}</span>
                    {last && !sending && (
                      <span className="block text-[10px] text-white/35 mt-0.5">
                        fired {timeAgo(last)}
                      </span>
                    )}
                  </span>
                  {sending ? (
                    <Loader2 className="h-4 w-4 text-white/65 animate-spin shrink-0" />
                  ) : (
                    <motion.span
                      whileTap={{ scale: 0.95 }}
                      className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-white text-dark-blue
                                 font-display text-xs h-8 px-3"
                    >
                      Post
                    </motion.span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </BottomSheet>
    </>
  );
}

function DrawerSwitch({
  icon,
  label,
  on,
  disabled,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  on: boolean;
  disabled: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      aria-pressed={on}
      className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5
                 glass-surface hover:bg-white/[0.07] transition text-left
                 disabled:opacity-60"
    >
      {/* Icon stays itself in both states; only the tile's tint
          flips. Replacing the icon with a Check on "on" read as
          two different controls — colour-only is the cleaner
          status signal. */}
      <span
        className={`shrink-0 grid place-items-center h-8 w-8 rounded-lg transition
                    ${on ? "bg-success/20 ring-1 ring-success/40 text-success" : "bg-white/[0.06] ring-1 ring-white/12 text-white/55"}`}
      >
        {icon}
      </span>
      <span className="flex-1 font-display text-sm text-white">{label}</span>
      <TogglePill on={on} />
    </button>
  );
}
