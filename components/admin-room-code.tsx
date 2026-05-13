"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ROOM_CODE_REGEX } from "@/lib/rooms";

// Admin › room › Settings: change the human-friendly join code.
// Heads-up: this invalidates any links/QRs already handed out.
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
    <form onSubmit={submit} className="flex flex-col gap-2">
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
      <p className="text-[11px] text-white/35">Changing this breaks any old links and QR codes for the room.</p>
    </form>
  );
}
