"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
      const { code } = (await res.json()) as { code: string };
      toast.success(`Room ${code} created.`);
      router.push(`/admin/rooms/${code}`);
    });
  };

  return (
    <div className="relative">
      <AnimatePresence mode="wait" initial={false}>
        {open ? (
          <motion.form
            key="form"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onSubmit={submit}
            className="flex gap-2"
          >
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 60))}
              placeholder="Party name"
              className="h-10 w-40 sm:w-56"
              maxLength={60}
              disabled={pending}
            />
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Create"
              )}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setOpen(false);
                setName("");
              }}
              disabled={pending}
            >
              Cancel
            </Button>
          </motion.form>
        ) : (
          <motion.div
            key="btn"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Create room
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
