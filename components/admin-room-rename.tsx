"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
    <form onSubmit={submit} className="flex gap-2">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value.slice(0, 60))}
        className="h-10 flex-1"
        maxLength={60}
      />
      <Button type="submit" size="sm" disabled={!dirty || pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
