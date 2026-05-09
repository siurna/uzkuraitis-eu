"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function AdminRoomToggle({
  code,
  initialEnabled,
}: {
  code: string;
  initialEnabled: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, start] = useTransition();

  const flip = () => {
    start(async () => {
      const next = !enabled;
      const res = await fetch(`/api/admin/rooms/${code}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ votingEnabled: next }),
      });
      if (!res.ok) {
        toast.error("Couldn't update the room.");
        return;
      }
      setEnabled(next);
      toast.success(next ? "Voting opened" : "Voting closed");
    });
  };

  return (
    <Button
      variant={enabled ? "default" : "outline"}
      size="sm"
      onClick={flip}
      disabled={pending}
      className={
        enabled
          ? "bg-success/20 text-success border-success/40"
          : "border-white/20 text-white/60"
      }
    >
      {enabled ? "Voting open" : "Voting closed"}
    </Button>
  );
}
