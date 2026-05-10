"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Eraser, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// Two destructive actions:
//   - Reset votes  → wipe all voters & their ballots, keep the room.
//   - Delete room  → wipe the room itself and every child row.
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
    <section className="rounded-xl border border-error/30 bg-error/5 p-5 flex flex-col gap-4">
      <header className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-error" />
        <h2 className="font-display text-xl">Danger zone</h2>
      </header>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 flex flex-col gap-1">
          <p className="font-display">Reset all votes</p>
          <p className="text-xs text-white/50">
            Removes every voter and their ballot from this room. The room
            and its code stay live.
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
              onClick={reset}
              disabled={pending}
              className="bg-error text-white"
            >
              <Eraser className="h-4 w-4 mr-1.5" />
              Yes, reset
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setConfirm("reset")}
            className="border-error/40 text-error hover:bg-error/10"
          >
            <Eraser className="h-4 w-4 mr-1.5" />
            Reset
          </Button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 pt-3 border-t border-white/5">
        <div className="flex-1 flex flex-col gap-1">
          <p className="font-display">Delete this room</p>
          <p className="text-xs text-white/50">
            The room, its code, all voters, ballots, and reactions are
            permanently removed. Anyone with the code will see "Room not
            found".
          </p>
        </div>
        {confirm === "delete" ? (
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
              onClick={remove}
              disabled={pending}
              className="bg-error text-white"
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Delete forever
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setConfirm("delete")}
            className="border-error/40 text-error hover:bg-error/10"
          >
            <Trash2 className="h-4 w-4 mr-1.5" />
            Delete
          </Button>
        )}
      </div>
    </section>
  );
}
