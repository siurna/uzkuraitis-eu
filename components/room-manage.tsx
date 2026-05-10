"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Copy, Check, Mic, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

// Strip-down magic admin page. Two toggles:
//   1. Voting open  — voters can submit / update their ballot.
//   2. Tally bets    — leaderboard + scoring goes live for this room.
//
// Both are persisted on rooms.* and pushed to every connected client
// over Liveblocks the moment they flip, so spectators see the change
// without a refresh.
type Room = {
  code: string;
  name: string;
  votingEnabled: boolean;
  tallyEnabled: boolean;
};

export function RoomManage({
  adminToken,
  room,
}: {
  adminToken: string;
  room: Room;
}) {
  const router = useRouter();
  const [voting, setVoting] = useState(room.votingEnabled);
  const [tally, setTally] = useState(room.tallyEnabled);
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);

  const headers = {
    "content-type": "application/json",
    "x-admin-token": adminToken,
  };

  const patch = (next: Partial<Room>) => {
    start(async () => {
      const res = await fetch(`/api/rooms/${room.code}/manage`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(next),
      });
      if (!res.ok) {
        toast.error("Couldn't save.");
        return;
      }
      router.refresh();
    });
  };

  const toggleVoting = () => {
    const next = !voting;
    setVoting(next);
    patch({ votingEnabled: next });
  };

  const toggleTally = () => {
    const next = !tally;
    setTally(next);
    patch({ tallyEnabled: next });
  };

  const adminUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/r/${room.code}/manage?key=${adminToken}`
      : "";
  const copy = async () => {
    if (!adminUrl) return;
    await navigator.clipboard.writeText(adminUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-10 gap-8">
      <header className="text-center flex flex-col gap-1">
        <p className="text-xs uppercase tracking-[0.4em] text-white/40 font-display">
          Hosting
        </p>
        <h1 className="font-display text-3xl gradient-text">{room.name}</h1>
        <code className="text-xs text-flamingo tracking-[0.3em] font-display mt-1">
          {room.code}
        </code>
      </header>

      <div className="w-full max-w-md flex flex-col gap-3">
        <ToggleCard
          icon={<Mic className="h-5 w-5" />}
          title="Voting open"
          sub={
            voting
              ? "Voters can cast and update their ballot."
              : "Ballots are locked. Open before showtime."
          }
          on={voting}
          onChange={toggleVoting}
          disabled={pending}
        />

        <ToggleCard
          icon={<Trophy className="h-5 w-5" />}
          title="Tally up bets"
          sub={
            tally
              ? "Leaderboard is live; scores update as results come in."
              : "Hide the leaderboard until you flip this on. Useful for async parties."
          }
          on={tally}
          onChange={toggleTally}
          disabled={pending}
        />
      </div>

      <section className="glass-card w-full max-w-md rounded-2xl p-4 flex flex-col gap-2">
        <p className="text-xs text-white/45 leading-relaxed">
          Bookmark this URL to manage the room any time. Sharing it gives
          full admin to whoever has the link.
        </p>
        <div className="flex items-center gap-2 pt-1">
          <code className="flex-1 truncate text-xs bg-black/30 rounded-md px-3 py-2 font-mono">
            {adminUrl || "loading…"}
          </code>
          <Button size="sm" variant="outline" onClick={copy}>
            {copied ? (
              <>
                <Check className="h-4 w-4 mr-1.5" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-1.5" />
                Copy
              </>
            )}
          </Button>
        </div>
      </section>
    </main>
  );
}

// --- toggle card ----------------------------------------------------------

function ToggleCard({
  icon,
  title,
  sub,
  on,
  onChange,
  disabled,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  on: boolean;
  onChange: () => void;
  disabled: boolean;
}) {
  return (
    <motion.button
      type="button"
      onClick={onChange}
      disabled={disabled}
      whileTap={{ scale: 0.99 }}
      className={`text-left list-entry-gradient list-card-hover glass-card rounded-2xl p-5
                  flex items-center gap-4 transition
                  ${on ? "ring-1 ring-flamingo/50 shadow-glow-pink" : ""}`}
    >
      <span
        className={`shrink-0 h-11 w-11 rounded-full grid place-items-center transition
                    ${on ? "bg-flamingo text-white" : "bg-white/10 text-white/60"}`}
      >
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-display text-lg">{title}</p>
        <p className="text-xs text-white/55 leading-relaxed">{sub}</p>
      </div>
      <span
        className={`relative h-6 w-11 rounded-full transition shrink-0 ${
          on ? "bg-success/70 shadow-glow-pink" : "bg-white/10"
        }`}
        aria-hidden
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition transform ${
            on ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </span>
    </motion.button>
  );
}
