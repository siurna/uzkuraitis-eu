"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Copy, Check, Mic, Trophy, Eraser, ChevronRight, Radio } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { HeartFlag } from "@/components/flag";
import { CountryDrawer } from "@/components/country-drawer";
import { getCountry } from "@/lib/countries";

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
  nowPlayingCode: string | null;
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
  const [nowPlaying, setNowPlaying] = useState<string | null>(room.nowPlayingCode);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);
  const [confirmClean, setConfirmClean] = useState(false);

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

  const pickNowPlaying = (code: string | null) => {
    setNowPlaying(code);
    setPickerOpen(false);
    patch({ nowPlayingCode: code });
  };

  const cleanOut = () => {
    start(async () => {
      const res = await fetch(`/api/rooms/${room.code}/manage`, {
        method: "DELETE",
        headers,
      });
      if (!res.ok) {
        toast.error("Couldn't clean out the room.");
        return;
      }
      toast.success("Room cleaned out.");
      setConfirmClean(false);
      router.refresh();
    });
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

        {/* Now playing — pick the country currently on stage. Every
            client in the room sees the strip flip + a swarm of that
            country's heart-flag explodes across their screen. */}
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          disabled={pending}
          className="text-left list-card-hover glass-card rounded-2xl p-5
                     flex items-center gap-4 transition"
        >
          <span className="shrink-0 h-11 w-11 rounded-full grid place-items-center
                           bg-flamingo/30 text-flamingo">
            <Radio className="h-5 w-5" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-display text-lg">Now playing</p>
            <p className="text-xs text-white/55 leading-relaxed">
              {(() => {
                const c = nowPlaying ? getCountry(nowPlaying) : null;
                if (!c) return "Tap to set the country currently on stage.";
                return `${c.name}${c.artist ? ` — ${c.artist}` : ""}`;
              })()}
            </p>
          </div>
          {nowPlaying ? (
            <HeartFlag code={nowPlaying} size="sm" />
          ) : (
            <ChevronRight className="h-4 w-4 text-white/30 shrink-0" />
          )}
        </button>
      </div>

      <section className="glass-card w-full max-w-md rounded-2xl p-4 flex items-center gap-2">
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
      </section>

      {/* Clean out — wipes every voter + their ballots from this room
          (room itself stays). Two-tap confirm so a fat finger doesn't
          nuke an in-progress party. */}
      <section className="w-full max-w-md flex flex-col gap-2">
        {confirmClean ? (
          <div className="flex items-center gap-2 rounded-2xl bg-error/10 ring-1 ring-error/30 px-4 py-3">
            <p className="flex-1 text-sm text-white/85">
              Kick everyone? Removes every voter and ballot.
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConfirmClean(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={cleanOut}
              disabled={pending}
              className="bg-error text-white hover:bg-error/90"
            >
              <Eraser className="h-4 w-4 mr-1.5" />
              Yes, kick
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmClean(true)}
            className="flex items-center justify-center gap-2 rounded-2xl px-4 py-3
                       bg-white/[0.03] ring-1 ring-white/10 hover:ring-error/40
                       text-error/80 hover:text-error text-sm transition"
          >
            <Eraser className="h-4 w-4" />
            Clean out room
          </button>
        )}
      </section>

      <CountryDrawer
        title="Now playing"
        sub="Pick the country currently on stage. Tap a country to send the swarm; tap 'No country' to clear."
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        selected={nowPlaying ? [nowPlaying] : []}
        onPick={(v) => pickNowPlaying(typeof v === "string" ? v : null)}
        allowNone
      />
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
      className={`text-left list-card-hover glass-card rounded-2xl p-5
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
