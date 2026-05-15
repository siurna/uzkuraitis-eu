"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Hash } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ROOM_CODE_REGEX } from "@/lib/room-code";

// Tile-shaped join-code editor. Same shape as the rename row + the
// behaviour toggles so Identity reads as a single visual family.
export function AdminRoomCode({ code }: { code: string }) {
  const router = useRouter();
  const [draft, setDraft] = useState(code);
  const [pending, start] = useTransition();
  const next = draft.trim().toUpperCase();
  const dirty = next !== code;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dirty) return;
    if (!ROOM_CODE_REGEX.test(next)) {
      toast.error("Codes are 6 characters: 1-9 and A-Z (no 0, I, L, O).");
      return;
    }
    start(async () => {
      const res = await fetch(`/api/admin/rooms/${code}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: next }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; code?: string; error?: string };
      if (!res.ok || !data.ok) {
        toast.error(data.error ?? "Couldn't change the code.");
        return;
      }
      toast.success(`Code is now ${data.code ?? next}.`);
      router.replace(`/admin/rooms/${data.code ?? next}`);
      router.refresh();
    });
  };

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl glass-surface px-4 py-3 flex flex-col gap-3"
    >
      <div className="flex items-center gap-3">
        <span className="shrink-0 grid place-items-center h-10 w-10 uzk-icon-squircle bg-white/[0.06] ring-1 ring-white/12 text-white/65">
          <Hash className="h-5 w-5" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block font-display text-base">Join code</span>
          <span className="block text-xs text-white/50 leading-snug text-balance">
            The 6 chars voters type at /. Changing breaks old links + QRs.
          </span>
        </span>
      </div>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value.toUpperCase().replace(/[^1-9A-Z]/g, "").slice(0, 6))}
          className="h-10 flex-1 font-mono tracking-[0.3em] text-center uppercase"
          maxLength={6}
          spellCheck={false}
          autoCapitalize="characters"
        />
        <Button type="submit" size="sm" disabled={!dirty || pending}>
          {pending ? "Saving…" : "Change"}
        </Button>
      </div>
    </form>
  );
}
