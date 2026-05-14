"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Tile-shaped room-rename row. Same outer shell as the behaviour
// toggles (icon tile + title + sub) so Identity reads as part of the
// same visual family; the actual control (input + save) lives in the
// row's body slot below the header line.
export function AdminRoomRename({
  code,
  initialName,
}: {
  code: string;
  initialName: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [pending, start] = useTransition();

  const dirty = name.trim() !== initialName && name.trim().length > 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dirty) return;
    start(async () => {
      const res = await fetch(`/api/admin/rooms/${code}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) {
        toast.error("Couldn't rename the room.");
        return;
      }
      toast.success("Renamed.");
      router.refresh();
    });
  };

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl glass-surface px-4 py-3 flex flex-col gap-3"
    >
      <div className="flex items-center gap-3">
        <span className="shrink-0 grid place-items-center h-10 w-10 rounded-xl bg-white/[0.06] ring-1 ring-white/12 text-white/65">
          <Pencil className="h-5 w-5" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block font-display text-base">Room name</span>
          <span className="block text-xs text-white/50 leading-snug">
            Shown on the join screen + every header. 60 char max.
          </span>
        </span>
      </div>
      <div className="flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 60))}
          className="h-10 flex-1"
          maxLength={60}
        />
        <Button type="submit" size="sm" disabled={!dirty || pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}
