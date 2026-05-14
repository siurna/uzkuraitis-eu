"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Copy, Check, Mic, Megaphone, Trophy, Eraser, Hash } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RoomLiveControls, type ShowStatus } from "@/components/room-live-controls";
import { ROOM_CODE_REGEX } from "@/lib/room-code";

// Magic-link host page. Three blocks:
//   1. Live — show status + country-on-stage controls (also on
//      /admin/rooms/[code]; the host gets it here without a passkey).
//   2. Voting / tally toggles.
//   3. Admin link + clean-out.
type Room = {
  code: string;
  name: string;
  votingEnabled: boolean;
  tallyEnabled: boolean;
  commentatorEnabled: boolean;
  nowPlayingCode: string | null;
  showStatus: ShowStatus;
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
  const [commentator, setCommentator] = useState(room.commentatorEnabled);
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);
  const [confirmClean, setConfirmClean] = useState(false);
  const [codeDraft, setCodeDraft] = useState(room.code);
  const [savingCode, setSavingCode] = useState(false);

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

  const toggleCommentator = () => {
    const next = !commentator;
    setCommentator(next);
    patch({ commentatorEnabled: next });
  };

  const saveCode = () => {
    const next = codeDraft.trim().toUpperCase();
    if (next === room.code) return;
    if (!ROOM_CODE_REGEX.test(next)) {
      toast.error("Codes are 6 characters: 1-9 and A-Z (no 0, I, L, O).");
      return;
    }
    setSavingCode(true);
    start(async () => {
      const res = await fetch(`/api/rooms/${room.code}/manage`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ code: next }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; code?: string; error?: string };
      setSavingCode(false);
      if (!res.ok || !data.ok) {
        toast.error(data.error ?? "Couldn't change the code.");
        return;
      }
      toast.success(`Code is now ${data.code ?? next}.`);
      router.push(`/r/${data.code ?? next}/manage?key=${adminToken}`);
      router.refresh();
    });
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
    <main className="min-h-dvh flex flex-col items-center px-4 py-10 gap-8">
      <header className="text-center flex flex-col gap-1">
        <p className="text-xs uppercase tracking-[0.4em] text-white/40 font-display">
          Hosting
        </p>
        <h1 className="font-display text-3xl gradient-text">{room.name}</h1>
        <code className="text-xs text-flamingo tracking-[0.3em] font-display mt-1">
          {room.code}
        </code>
      </header>

      {/* Live show controls for THIS room. (The global /admin/live page
          can broadcast to every room at once; this is the per-room
          host's own override.) */}
      <section className="w-full max-w-md glass-card rounded-2xl p-4 flex flex-col gap-3">
        <header>
          <h2 className="font-display text-lg">Live</h2>
        </header>
        <RoomLiveControls
          initialStatus={room.showStatus}
          initialNowPlaying={room.nowPlayingCode}
          apply={async (patch) => {
            const res = await fetch(`/api/rooms/${room.code}/manage`, {
              method: "PATCH",
              headers,
              body: JSON.stringify(patch),
            });
            return res.ok;
          }}
        />
      </section>

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

        <ToggleCard
          icon={<Megaphone className="h-5 w-5" />}
          title="Live commentator"
          sub={
            commentator
              ? "The bot drops a line in chat when a country hits the stage."
              : "Bot is muted in this room (it's still on elsewhere)."
          }
          on={commentator}
          onChange={toggleCommentator}
          disabled={pending}
        />
      </div>

      <section className="glass-card w-full max-w-md rounded-2xl p-4 flex flex-col gap-2">
        <div className="flex items-center gap-2 text-white/70">
          <Hash className="h-4 w-4 text-white/40" />
          <span className="font-display text-sm">Join code</span>
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={codeDraft}
            onChange={(e) =>
              setCodeDraft(
                e.target.value
                  .toUpperCase()
                  .replace(/[^1-9A-Z]/g, "")
                  .slice(0, 6),
              )
            }
            className="h-10 flex-1 font-mono tracking-[0.3em] text-center uppercase"
            maxLength={6}
            spellCheck={false}
            autoCapitalize="characters"
          />
          <Button
            size="sm"
            onClick={saveCode}
            disabled={savingCode || pending || codeDraft.trim().toUpperCase() === room.code}
          >
            {savingCode ? "Saving…" : "Change"}
          </Button>
        </div>
        <p className="text-[11px] text-white/35">
          Changing this breaks any old links and QR codes for the room.
        </p>
      </section>

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
          (room itself stays). Two-tap confirm. */}
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
