"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { isValidRoomCode, normalizeRoomCode } from "@/lib/rooms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo2026 } from "@/components/logo-2026";

type Mode = "join" | "create";

export function RoomGate({ prefilled = "" }: { prefilled?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(prefilled ? "join" : "join");
  const [code, setCode] = useState(prefilled);
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = normalizeRoomCode(code);
    if (!isValidRoomCode(normalized)) {
      toast.error("Room codes are 6 characters (A-Z, 2-9).");
      return;
    }
    startTransition(async () => {
      const res = await fetch(`/api/rooms/${normalized}`);
      if (!res.ok) {
        toast.error("No room with that code. Double-check or create a new one.");
        return;
      }
      router.push(`/r/${normalized}`);
    });
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim() || "Eurovision party" }),
      });
      if (!res.ok) {
        toast.error("Couldn't create the room. Try again?");
        return;
      }
      const { code: newCode } = (await res.json()) as { code: string };
      router.push(`/r/${newCode}`);
    });
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md flex flex-col items-center gap-8">
        <Logo2026 className="w-full max-w-xs" />

        <div className="glass-card w-full rounded-xl p-6 sm:p-8 flex flex-col gap-6">
          <div className="flex items-center justify-center gap-2 rounded-full bg-black/30 p-1 text-sm">
            <button
              type="button"
              onClick={() => setMode("join")}
              className={`flex-1 rounded-full py-2 transition ${
                mode === "join"
                  ? "bg-flamingo text-white shadow-glow-pink"
                  : "text-white/70 hover:text-white"
              }`}
            >
              Join a room
            </button>
            <button
              type="button"
              onClick={() => setMode("create")}
              className={`flex-1 rounded-full py-2 transition ${
                mode === "create"
                  ? "bg-flamingo text-white shadow-glow-pink"
                  : "text-white/70 hover:text-white"
              }`}
            >
              Create new
            </button>
          </div>

          {mode === "join" ? (
            <form onSubmit={handleJoin} className="flex flex-col gap-4">
              <label className="text-sm font-medium text-white/80">
                Room code
                <Input
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.toUpperCase().slice(0, 6))
                  }
                  placeholder="ABC123"
                  autoFocus
                  className="mt-2 h-14 text-center text-2xl font-display tracking-[0.5em] uppercase"
                  inputMode="text"
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={6}
                />
              </label>
              <Button
                type="submit"
                disabled={pending}
                className="h-14 text-lg font-display"
              >
                {pending ? "Checking…" : "Enter room"}
              </Button>
              <p className="text-xs text-center text-white/50">
                Got a link with <code>?room=ABC123</code>? It'll bring you
                straight in.
              </p>
            </form>
          ) : (
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <label className="text-sm font-medium text-white/80">
                Party name
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value.slice(0, 60))}
                  placeholder="Linda's couch"
                  autoFocus
                  className="mt-2 h-14"
                />
              </label>
              <Button
                type="submit"
                disabled={pending}
                className="h-14 text-lg font-display"
              >
                {pending ? "Creating…" : "Create room"}
              </Button>
              <p className="text-xs text-center text-white/50">
                You'll get a 6-character code to share with friends.
              </p>
            </form>
          )}
        </div>

        <p className="text-xs text-white/40 font-display tracking-widest uppercase">
          Užkuraitis · United by music
        </p>
      </div>
    </main>
  );
}
