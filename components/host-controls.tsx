"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import {
  Check,
  Eraser,
  Hash,
  Lightbulb,
  Megaphone,
  Mic,
  Share2,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminPageTitle } from "@/components/admin-page-title";
import { ROOM_CODE_REGEX } from "@/lib/room-code";

// Per-room host page (magic-link gated). Mirrors the /admin/* visual
// language — gradient title, glass-card sections with their own
// header + subtitle, tile-shaped toggle rows. Lives at /host/[code]
// OUTSIDE the room shell, so the host's surface is admin chrome only
// (no voter UI, no NameGate, no tab bar).
//
// Live panel (now-playing / show-status) is intentionally NOT here:
// it's a GLOBAL thing, owned by /admin/live, broadcast to every
// room at once. The host doesn't pick what's on stage per-room.
type Room = {
  code: string;
  name: string;
  votingEnabled: boolean;
  tallyEnabled: boolean;
  triviaEnabled: boolean;
  commentatorEnabled: boolean;
};

export function HostControls({
  adminToken,
  room,
}: {
  adminToken: string;
  room: Room;
}) {
  const router = useRouter();
  const [voting, setVoting] = useState(room.votingEnabled);
  const [tally, setTally] = useState(room.tallyEnabled);
  const [trivia, setTrivia] = useState(room.triviaEnabled);
  const [commentator, setCommentator] = useState(room.commentatorEnabled);
  const [pending, start] = useTransition();
  const [confirmClean, setConfirmClean] = useState(false);
  const [codeDraft, setCodeDraft] = useState(room.code);
  const [savingCode, setSavingCode] = useState(false);
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => setOrigin(window.location.origin), []);

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
  const toggleTrivia = () => {
    const next = !trivia;
    setTrivia(next);
    patch({ triviaEnabled: next });
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
      const data = (await res
        .json()
        .catch(() => ({}))) as { ok?: boolean; code?: string; error?: string };
      setSavingCode(false);
      if (!res.ok || !data.ok) {
        toast.error(data.error ?? "Couldn't change the code.");
        return;
      }
      toast.success(`Code is now ${data.code ?? next}.`);
      router.push(`/host/${data.code ?? next}?key=${adminToken}`);
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

  const roomUrl = origin ? `${origin}/?room=${room.code}` : `/?room=${room.code}`;

  const share = async () => {
    if (!roomUrl) return;
    // Native share sheet when the platform supports it; clipboard as
    // a fallback so desktop browsers still get something useful.
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title: `Join ${room.name}`, url: roomUrl });
        return;
      } catch {
        /* user dismissed the sheet */
      }
    }
    try {
      await navigator.clipboard.writeText(roomUrl);
      setCopied(true);
      toast.success("Room link copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy. Long-press the address bar.");
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <AdminPageTitle
        subtitle={
          <>
            Magic-link controls for{" "}
            <code className="font-mono text-flamingo tracking-[0.2em]">
              {room.code}
            </code>
            . Show running order + on-stage country are global; this page
            owns just this room's toggles and identity.
          </>
        }
      >
        {room.name}
      </AdminPageTitle>

      {/* Behaviour toggles — three tile-shaped rows mirroring the
          shape used inside the global /admin/rooms/[code] settings
          tab. Each row autosaves on flip. */}
      <section className="glass-card rounded-xl p-5 flex flex-col gap-3">
        <header>
          <h2 className="font-display text-xl leading-tight">Behaviour</h2>
          <p className="text-xs text-white/45 mt-0.5 text-balance">
            Toggles that change what this room does during the show.
          </p>
        </header>
        <ToggleRow
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
        <ToggleRow
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
        <ToggleRow
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
        <ToggleRow
          icon={<Lightbulb className="h-5 w-5" />}
          title="Trivia in chat"
          sub={
            trivia
              ? "Mid-song trivia card drops in when the global scheduler fires."
              : "No trivia in this room, even if the rest of the show gets one."
          }
          on={trivia}
          onChange={toggleTrivia}
          disabled={pending}
        />
      </section>

      {/* Identity & invites — the room link to share with voters,
          and the join code itself. */}
      <section className="glass-card rounded-xl p-5 flex flex-col gap-3">
        <header>
          <h2 className="font-display text-xl leading-tight">Identity & invites</h2>
          <p className="text-xs text-white/45 mt-0.5 text-balance">
            What you hand out to viewers. The join code lives at the
            tail of the URL.
          </p>
        </header>

        {/* Room link — single tile, native share when available,
            clipboard fallback. The magic-link manage URL used to live
            here too; it's been removed (the host already has it, and
            it doesn't belong in the same UI as the public room link). */}
        <div className="rounded-2xl glass-surface px-4 py-3 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="shrink-0 grid place-items-center h-10 w-10 rounded-xl bg-white/[0.06] ring-1 ring-white/12 text-white/65">
              <Share2 className="h-5 w-5" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block font-display text-base">Room link</span>
              <span className="block text-xs text-white/50 leading-snug text-balance">
                Send this to viewers. They'll land straight on the join screen.
              </span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate text-xs bg-black/30 rounded-md px-3 py-2 font-mono">
              {roomUrl || "loading…"}
            </code>
            <Button size="sm" variant="outline" onClick={share} disabled={!roomUrl}>
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-1.5" /> Copied
                </>
              ) : (
                <>
                  <Share2 className="h-4 w-4 mr-1.5" /> Share
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Join code editor — same tile shape. */}
        <div className="rounded-2xl glass-surface px-4 py-3 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="shrink-0 grid place-items-center h-10 w-10 rounded-xl bg-white/[0.06] ring-1 ring-white/12 text-white/65">
              <Hash className="h-5 w-5" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block font-display text-base">Join code</span>
              <span className="block text-xs text-white/50 leading-snug text-balance">
                Changing this breaks any old links and QR codes for the room.
              </span>
            </span>
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
              disabled={
                savingCode ||
                pending ||
                codeDraft.trim().toUpperCase() === room.code
              }
            >
              {savingCode ? "Saving…" : "Change"}
            </Button>
          </div>
        </div>
      </section>

      {/* Danger zone — clean out wipes every voter + their ballots
          from the room. Two-tap confirm so a fat finger can't nuke
          a live party. */}
      <section className="glass-card rounded-xl p-5 flex flex-col gap-3">
        <header>
          <h2 className="font-display text-xl leading-tight">Danger zone</h2>
          <p className="text-xs text-white/45 mt-0.5 text-balance">
            Wipe the room's participants + ballots. The room itself stays.
          </p>
        </header>
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
    </div>
  );
}

// Single toggle row — same shape as the per-room admin tiles. Icon
// left, title + sub, switch right. Tap anywhere to flip.
function ToggleRow({
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
      className="w-full text-left flex items-center gap-3 rounded-2xl px-3 py-2.5
                 bg-white/[0.03] ring-1 ring-white/8 hover:bg-white/[0.06] transition
                 disabled:opacity-60"
    >
      <span
        className={`shrink-0 grid place-items-center h-10 w-10 rounded-xl transition
                    ${
                      on
                        ? "bg-flamingo/20 ring-1 ring-flamingo/40 text-flamingo"
                        : "bg-white/[0.04] ring-1 ring-white/12 text-white/65"
                    }`}
      >
        {icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block font-display text-base">{title}</span>
        <span className="block text-xs text-white/55 leading-snug text-balance">
          {sub}
        </span>
      </span>
      <span
        className={`shrink-0 relative h-6 w-11 rounded-full transition ${
          on ? "bg-success/85" : "bg-white/10"
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
