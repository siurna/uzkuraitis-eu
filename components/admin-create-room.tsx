"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BottomSheet } from "@/components/ui/bottom-sheet";

export function AdminCreateRoom() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim() || "Eurovision party" }),
      });
      if (!res.ok) {
        toast.error("Couldn't create the room.");
        return;
      }
      const { code, adminToken } = (await res.json()) as {
        code: string;
        adminToken: string;
      };
      // Drop the host-side admin URL on the clipboard so the global
      // admin can paste it to whoever's running the room. Bookmarkable.
      const url = `${window.location.origin}/r/${code}/manage?key=${adminToken}`;
      try {
        await navigator.clipboard.writeText(url);
        toast.success(`Room ${code} created. Admin link copied.`);
      } catch {
        toast.success(`Room ${code} created.`);
      }
      setOpen(false);
      setName("");
      router.push(`/admin/rooms/${code}`);
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
          <div className="flex gap-2">
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
        <form id="admin-create-room-form" onSubmit={submit} className="flex flex-col gap-2 py-1">
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
        </form>
      </BottomSheet>
    </>
  );
}
