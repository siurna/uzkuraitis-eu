"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "motion/react";
import {
  ArrowLeft,
  Save,
  Copy,
  Check,
  AlertTriangle,
  Eraser,
  Trash2,
  Download,
  ListOrdered,
  Trophy,
  Settings as SettingsIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AdminOfficialResults } from "@/components/admin-official-results";
import { AdminOfficialFacts } from "@/components/admin-official-facts";
import { isValidRoomCode, normalizeRoomCode } from "@/lib/rooms";

// Inline editor for a per-room admin. The admin token comes through the
// URL once on first load and is then embedded in every fetch as the
// X-Admin-Token header. We never persist it to localStorage; the URL is
// the credential.
type Room = {
  code: string;
  name: string;
  votingEnabled: boolean;
  homeCountryCode: string;
};

type ResultRow = { countryCode: string; placement: number };

export function RoomManage({
  adminToken,
  room,
  results: initialResults,
  facts: initialFacts,
}: {
  adminToken: string;
  room: Room;
  results: ResultRow[];
  facts: Record<string, string>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const headers = {
    "content-type": "application/json",
    "x-admin-token": adminToken,
  };

  // ---- room props (settings tab) -------------------------------------
  const [name, setName] = useState(room.name);
  const [code, setCode] = useState(room.code);
  const [votingEnabled, setVotingEnabled] = useState(room.votingEnabled);
  const [homeCountry, setHomeCountry] = useState(room.homeCountryCode);

  const dirty =
    name.trim() !== room.name ||
    normalizeRoomCode(code) !== room.code ||
    votingEnabled !== room.votingEnabled ||
    homeCountry !== room.homeCountryCode;

  const saveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dirty) return;
    const patch: Record<string, unknown> = {};
    if (name.trim() !== room.name) patch.name = name.trim();
    if (votingEnabled !== room.votingEnabled)
      patch.votingEnabled = votingEnabled;
    if (homeCountry !== room.homeCountryCode)
      patch.homeCountryCode = homeCountry;
    const wantNewCode = normalizeRoomCode(code) !== room.code;
    if (wantNewCode) {
      const norm = normalizeRoomCode(code);
      if (!isValidRoomCode(norm)) {
        toast.error("Codes are 6 chars (A–Z minus I/L/O, 2–9).");
        return;
      }
      patch.code = norm;
    }
    start(async () => {
      const res = await fetch(`/api/rooms/${room.code}/manage`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const { error } = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        toast.error(error ?? "Couldn't save.");
        return;
      }
      const { code: newCode } = (await res.json()) as { code: string };
      toast.success("Saved.");
      // Code may have changed: replace URL so further admin actions point
      // at the new path. Token stays in the URL.
      if (newCode !== room.code) {
        router.replace(`/r/${newCode}/manage?key=${adminToken}`);
      } else {
        router.refresh();
      }
    });
  };

  // ---- danger zone ---------------------------------------------------
  const [confirm, setConfirm] = useState<"reset" | null>(null);
  const resetVotes = () => {
    start(async () => {
      const res = await fetch(`/api/rooms/${room.code}/manage`, {
        method: "DELETE",
        headers,
      });
      if (!res.ok) {
        toast.error("Couldn't reset.");
        return;
      }
      toast.success("All votes cleared.");
      setConfirm(null);
      router.refresh();
    });
  };

  // ---- import-from-global helpers ------------------------------------
  const importGlobalResults = () => {
    start(async () => {
      const res = await fetch(`/api/rooms/${room.code}/manage/results`, {
        method: "POST",
        headers,
      });
      if (!res.ok) {
        toast.error("Couldn't import.");
        return;
      }
      const { copied } = (await res.json()) as { copied: number };
      toast.success(
        copied === 0
          ? "Nothing to import yet, the global results are empty."
          : `Imported ${copied} placements.`,
      );
      router.refresh();
    });
  };

  const importGlobalFacts = () => {
    start(async () => {
      const res = await fetch(`/api/rooms/${room.code}/manage/facts`, {
        method: "POST",
        headers,
      });
      if (!res.ok) {
        toast.error("Couldn't import.");
        return;
      }
      const { copied } = (await res.json()) as { copied: number };
      toast.success(
        copied === 0
          ? "Nothing to import yet, the global facts are empty."
          : `Imported ${copied} facts.`,
      );
      router.refresh();
    });
  };

  // ---- share-link copy ------------------------------------------------
  const [copied, setCopied] = useState(false);
  const adminUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/r/${room.code}/manage?key=${adminToken}`
      : "";
  const copyAdminUrl = async () => {
    if (!adminUrl) return;
    await navigator.clipboard.writeText(adminUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <main className="min-h-screen flex flex-col pb-12">
      <header className="sticky top-0 z-30 backdrop-blur-md bg-dark-blue-900/70 border-b border-white/5">
        <div className="container mx-auto max-w-3xl px-4 py-3 flex items-center gap-3">
          <Link
            href={`/r/${room.code}`}
            className="text-white/60 hover:text-white transition"
            aria-label="Back to room"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1 min-w-0">
            <p className="font-display text-lg truncate">Manage</p>
            <p className="text-xs text-white/50 truncate">{name}</p>
          </div>
          <code className="text-xs font-mono uppercase tracking-[0.3em] text-flamingo">
            {room.code}
          </code>
        </div>
      </header>

      <div className="container mx-auto max-w-3xl px-4 py-6 flex flex-col gap-6">
        <section className="glass-card rounded-2xl p-4 sm:p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-flamingo" />
            <h2 className="font-display text-lg">Admin link</h2>
          </div>
          <p className="text-xs text-white/55">
            Anyone with this URL can manage <strong>{room.name}</strong>.
            Don&apos;t paste it publicly. Bookmark it for yourself.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate text-xs bg-black/30 rounded-md px-3 py-2 font-mono">
              {adminUrl || "loading…"}
            </code>
            <Button size="sm" variant="outline" onClick={copyAdminUrl}>
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

        <Tabs defaultValue="settings" className="flex flex-col gap-4">
          <TabsList className="self-start">
            <TabsTrigger value="settings">
              <SettingsIcon className="h-3.5 w-3.5" />
              <span>Settings</span>
            </TabsTrigger>
            <TabsTrigger value="results">
              <ListOrdered className="h-3.5 w-3.5" />
              <span>Results</span>
            </TabsTrigger>
            <TabsTrigger value="facts">
              <Trophy className="h-3.5 w-3.5" />
              <span>Side bets</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="settings" className="flex flex-col gap-4 mt-0">
            <motion.form
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              onSubmit={saveSettings}
              className="glass-card rounded-2xl p-5 flex flex-col gap-4"
            >
              <h2 className="font-display text-xl">Room settings</h2>

              <label className="flex flex-col gap-1.5 text-sm">
                <span className="text-white/70">Party name</span>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value.slice(0, 60))}
                  className="h-11"
                  maxLength={60}
                />
              </label>

              <label className="flex flex-col gap-1.5 text-sm">
                <span className="text-white/70">Join code</span>
                <Input
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.toUpperCase().slice(0, 6))
                  }
                  className="h-11 font-display tracking-[0.3em] uppercase text-center"
                  maxLength={6}
                />
                <span className="text-[11px] text-white/40">
                  6 characters from A–Z (no I, L, O) and 2–9. Changing this
                  invalidates the old code immediately.
                </span>
              </label>

              <label className="flex flex-col gap-1.5 text-sm">
                <span className="text-white/70">Home country (ISO)</span>
                <Input
                  value={homeCountry}
                  onChange={(e) =>
                    setHomeCountry(e.target.value.toLowerCase().slice(0, 2))
                  }
                  className="h-11 lowercase tracking-widest"
                  maxLength={2}
                />
                <span className="text-[11px] text-white/40">
                  Used for the &quot;where will [country] finish?&quot; bet
                  and the LT-12-to bet.
                </span>
              </label>

              <label className="flex items-center justify-between gap-3 text-sm py-2 border-t border-white/5 pt-3">
                <div>
                  <p>Voting open</p>
                  <p className="text-xs text-white/50">
                    Voters can submit / update their ballot.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setVotingEnabled((v) => !v)}
                  className={`relative h-6 w-11 rounded-full transition ${
                    votingEnabled
                      ? "bg-success/70 shadow-glow-pink"
                      : "bg-white/10"
                  }`}
                  aria-pressed={votingEnabled}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition transform ${
                      votingEnabled ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </label>

              <Button
                type="submit"
                disabled={!dirty || pending}
                className="bg-gradient-to-r from-gold via-flamingo to-purple text-white"
              >
                <Save className="h-4 w-4 mr-1.5" />
                {pending ? "Saving…" : "Save settings"}
              </Button>
            </motion.form>

            <section className="rounded-xl border border-error/30 bg-error/5 p-5 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-error" />
                <h3 className="font-display text-lg">Danger zone</h3>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-display">Reset all votes</p>
                  <p className="text-xs text-white/50">
                    Removes every voter and their ballot. Room and code stay.
                  </p>
                </div>
                {confirm === "reset" ? (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setConfirm(null)}
                      disabled={pending}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={resetVotes}
                      disabled={pending}
                      className="bg-error text-white"
                    >
                      <Eraser className="h-4 w-4 mr-1.5" />
                      Yes
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setConfirm("reset")}
                    className="border-error/40 text-error hover:bg-error/10"
                  >
                    <Trash2 className="h-4 w-4 mr-1.5" />
                    Reset
                  </Button>
                )}
              </div>
            </section>
          </TabsContent>

          <TabsContent value="results" className="flex flex-col gap-3 mt-0">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-sm text-white/55 flex-1 min-w-[12rem]">
                Per-room results. Overrides the global ones for this room
                only. Useful when you&apos;re watching the show on a delay.
              </p>
              <Button size="sm" variant="outline" onClick={importGlobalResults} disabled={pending}>
                <Download className="h-4 w-4 mr-1.5" />
                Import from official
              </Button>
            </div>
            <ScopedResults
              adminToken={adminToken}
              roomCode={room.code}
              initial={initialResults}
            />
          </TabsContent>

          <TabsContent value="facts" className="flex flex-col gap-3 mt-0">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-sm text-white/55 flex-1 min-w-[12rem]">
                Per-room side-bet ground truth. Overrides the global facts
                for this room only.
              </p>
              <Button size="sm" variant="outline" onClick={importGlobalFacts} disabled={pending}>
                <Download className="h-4 w-4 mr-1.5" />
                Import from official
              </Button>
            </div>
            <ScopedFacts
              adminToken={adminToken}
              roomCode={room.code}
              initial={initialFacts}
            />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}

// ---- thin wrappers around the existing admin editors -------------------
// They already POST/PUT to /api/admin/* but we want them to hit
// /api/rooms/[code]/manage/* with the X-Admin-Token header. Wrapping is
// cheaper than re-implementing 200 lines of editor UI.

function ScopedResults({
  adminToken,
  roomCode,
  initial,
}: {
  adminToken: string;
  roomCode: string;
  initial: { countryCode: string; placement: number }[];
}) {
  // We pass an override URL/headers via the global fetch interceptor
  // pattern; simplest is to give AdminOfficialResults props for the
  // endpoint it should use. Refactor that component to accept overrides.
  return (
    <AdminOfficialResults
      initial={initial}
      endpoint={`/api/rooms/${roomCode}/manage/results`}
      headers={{ "x-admin-token": adminToken }}
    />
  );
}

function ScopedFacts({
  adminToken,
  roomCode,
  initial,
}: {
  adminToken: string;
  roomCode: string;
  initial: Record<string, string>;
}) {
  return (
    <AdminOfficialFacts
      initial={initial}
      endpoint={`/api/rooms/${roomCode}/manage/facts`}
      headers={{ "x-admin-token": adminToken }}
    />
  );
}
