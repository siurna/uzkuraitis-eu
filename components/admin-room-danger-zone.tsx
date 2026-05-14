"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eraser, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// Tile-shaped destructive actions. Same shell as the Identity rows
// and the manage-link rows above so Operations reads as one card,
// not two; the error tint on the icon tile + the destructive button
// styling carries the "this is dangerous" signal instead of an
// outer red box.
export function AdminRoomDangerZone({ code }: { code: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState<"reset" | "delete" | null>(null);

  const reset = () => {
    start(async () => {
      const res = await fetch(`/api/admin/rooms/${code}/voters`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast.error("Couldn't reset votes.");
        return;
      }
      toast.success("All votes cleared.");
      setConfirm(null);
      router.refresh();
    });
  };

  const remove = () => {
    start(async () => {
      const res = await fetch(`/api/admin/rooms/${code}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast.error("Couldn't delete the room.");
        return;
      }
      toast.success("Room deleted.");
      router.replace("/admin");
    });
  };

  return (
    <>
      <div className="rounded-2xl bg-error/5 ring-1 ring-error/25 px-4 py-3 flex items-center gap-3">
        <span className="shrink-0 grid place-items-center h-10 w-10 rounded-xl bg-error/15 ring-1 ring-error/35 text-error">
          <Eraser className="h-5 w-5" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block font-display text-base">Reset all votes</span>
          <span className="block text-xs text-white/55 leading-snug">
            Wipes every voter + ballot in this room. The room itself stays.
          </span>
        </span>
        {confirm === "reset" ? (
          <span className="flex gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={() => setConfirm(null)} disabled={pending}>
              Cancel
            </Button>
            <Button size="sm" onClick={reset} disabled={pending} className="bg-error text-white">
              Yes, reset
            </Button>
          </span>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setConfirm("reset")}
            className="border-error/40 text-error hover:bg-error/10 shrink-0"
          >
            Reset
          </Button>
        )}
      </div>

      <div className="rounded-2xl bg-error/5 ring-1 ring-error/25 px-4 py-3 flex items-center gap-3">
        <span className="shrink-0 grid place-items-center h-10 w-10 rounded-xl bg-error/15 ring-1 ring-error/35 text-error">
          <Trash2 className="h-5 w-5" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block font-display text-base">Delete this room</span>
          <span className="block text-xs text-white/55 leading-snug">
            Room, code, voters, ballots, reactions, chat. All gone, no undo.
          </span>
        </span>
        {confirm === "delete" ? (
          <span className="flex gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={() => setConfirm(null)} disabled={pending}>
              Cancel
            </Button>
            <Button size="sm" onClick={remove} disabled={pending} className="bg-error text-white">
              Delete forever
            </Button>
          </span>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setConfirm("delete")}
            className="border-error/40 text-error hover:bg-error/10 shrink-0"
          >
            Delete
          </Button>
        )}
      </div>
    </>
  );
}
