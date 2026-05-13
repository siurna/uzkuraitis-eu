"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Shuffle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BottomSheet } from "@/components/ui/bottom-sheet";

// The auto-generator's conservative alphabet (no 0/1/I/L/O). The
// validator accepts `1` too, so a host can type a memorable custom code.
const ROOM_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

function localSuggestCode(): string {
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)];
  }
  return out;
}

export function AdminCreateRoom() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [pending, start] = useTransition();

  // Drop in a fresh suggestion each time the sheet opens; the host can
  // accept it as-is, reshuffle, or type their own.
  useEffect(() => {
    if (open) setCode(localSuggestCode());
  }, [open]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || "Eurovision party",
          code: code.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const { error } = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(error ?? "Couldn't create the room.");
        return;
      }
      const data = (await res.json()) as { code: string; adminToken: string };
      // Drop the host-side admin URL on the clipboard so the global
      // admin can paste it to whoever's running the room. Bookmarkable.
      const url = `${window.location.origin}/r/${data.code}/manage?key=${data.adminToken}`;
      try {
        await navigator.clipboard.writeText(url);
        toast.success(`Room ${data.code} created. Admin link copied.`);
      } catch {
        toast.success(`Room ${data.code} created.`);
      }
      setOpen(false);
      setName("");
      router.push(`/admin/rooms/${data.code}`);
    });
  };

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 mr-1.5" />
        Create room
      </Button>

      <BottomSheet
        open={open}
        onClose={() => !pending && setOpen(false)}
        title="New room"
        sub="Spin up a fresh room — you'll get a host link to hand off."
        footer={
          <div className="flex gap-2 w-full">
            <Button
              type="button"
              variant="ghost"
              className="flex-1"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" form="admin-create-room-form" className="flex-1" disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create room"}
            </Button>
          </div>
        }
      >
        <form id="admin-create-room-form" onSubmit={submit} className="flex flex-col gap-4 py-1">
          <div className="flex flex-col gap-2">
            <label className="text-xs uppercase tracking-[0.18em] text-white/40 font-display">Party name</label>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 60))}
              placeholder="Eurovision party"
              className="h-11"
              maxLength={60}
              disabled={pending}
            />
            <p className="text-[11px] text-white/35">Leave blank for the default name — you can rename it later.</p>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs uppercase tracking-[0.18em] text-white/40 font-display">Join code</label>
            <div className="flex gap-2">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^1-9A-Z]/g, "").slice(0, 6))}
                className="h-11 flex-1 font-mono tracking-[0.3em] text-center uppercase"
                maxLength={6}
                spellCheck={false}
                autoCapitalize="characters"
                disabled={pending}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setCode(localSuggestCode())}
                disabled={pending}
                aria-label="Suggest a new code"
              >
                <Shuffle className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-[11px] text-white/35">
              6 characters: 1–9 and A–Z (no 0, I, L, O). Edit the suggestion or roll a new one.
            </p>
          </div>
        </form>
      </BottomSheet>
    </>
  );
}
