"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Trash2, Loader2, ImageIcon } from "lucide-react";
import { toast } from "sonner";

// Per-participant moderation strip: a handful of their most-recent chat
// messages with a delete button each. Lives in the admin participants
// tab on /admin/rooms/[code]. The actual delete hits the admin-authed
// DELETE endpoint and broadcasts chat:delete so every connected client
// drops the row in real time.

export type AdminMessageRow = {
  id: string;
  kind: string;
  body: string | null;
  gifUrl: string | null;
  createdAt: string;
};

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.round(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

export function AdminParticipantMessages({
  code,
  messages,
}: {
  code: string;
  messages: AdminMessageRow[];
}) {
  const [rows, setRows] = useState(messages);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, start] = useTransition();

  if (rows.length === 0) {
    return (
      <p className="text-[11px] text-white/35 italic px-3 py-2">
        No messages from this participant yet.
      </p>
    );
  }

  const remove = (id: string) => {
    setPendingId(id);
    start(async () => {
      const res = await fetch(`/api/admin/rooms/${code}/chat/${id}`, {
        method: "DELETE",
      });
      setPendingId(null);
      if (!res.ok) {
        toast.error("Couldn't delete that message.");
        return;
      }
      setRows((prev) => prev.filter((r) => r.id !== id));
      toast.success("Message removed.");
    });
  };

  return (
    <ul className="flex flex-col gap-1 px-3 pb-3">
      <AnimatePresence initial={false}>
        {rows.map((m) => {
          const preview =
            m.kind === "bingo_strike"
              ? "🎯 Bingo!"
              : m.body
                ? m.body
                : m.gifUrl
                  ? m.kind === "image"
                    ? "Photo"
                    : "GIF"
                  : `(${m.kind})`;
          const isBusy = pendingId === m.id;
          return (
            <motion.li
              key={m.id}
              layout
              initial={{ opacity: 1 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.18 }}
              className="flex items-center gap-2 rounded-md bg-black/30 px-2 py-1.5"
            >
              <span className="text-[10px] text-white/35 tabular-nums shrink-0 w-14">
                {timeAgo(m.createdAt)}
              </span>
              {m.gifUrl && (
                <ImageIcon className="h-3 w-3 text-white/30 shrink-0" />
              )}
              <span className="flex-1 text-xs text-white/80 truncate">{preview}</span>
              <button
                type="button"
                onClick={() => remove(m.id)}
                disabled={isBusy}
                className="shrink-0 h-7 w-7 grid place-items-center rounded text-white/40 hover:text-error hover:bg-error/10 transition disabled:opacity-50"
                aria-label="Delete message"
              >
                {isBusy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
              </button>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ul>
  );
}
