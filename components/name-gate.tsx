"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useUpdateMyPresence } from "@/lib/liveblocks";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const NAME_KEY = "uzk_name";

// Modal-style overlay that asks the user for a display name on first
// entry to a room. Persists to localStorage so the prompt only shows
// once per device. The voting form reads the same key so it never has
// to ask again.
export function NameGate({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [name, setName] = useState("");
  const [draft, setDraft] = useState("");
  const updatePresence = useUpdateMyPresence();

  useEffect(() => {
    const stored = localStorage.getItem(NAME_KEY);
    if (stored) setName(stored);
    setHydrated(true);
  }, []);

  // Mirror the chosen name into Liveblocks presence so others see it
  // immediately on the avatar strip.
  useEffect(() => {
    if (name) updatePresence({ name });
  }, [name, updatePresence]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = draft.trim().slice(0, 40);
    if (!clean) return;
    localStorage.setItem(NAME_KEY, clean);
    setName(clean);
  };

  if (!hydrated) return null;

  return (
    <>
      {children}
      <AnimatePresence>
        {!name && (
          <motion.div
            key="namegate"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center px-4 bg-dark-blue-900/70 backdrop-blur-md"
          >
            <motion.form
              onSubmit={submit}
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 300, damping: 26 }}
              className="glass-card w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4"
            >
              <div className="text-center">
                <p className="font-display text-2xl gradient-text">
                  Welcome
                </p>
                <p className="text-sm text-white/55 mt-1">
                  What should we call you in this room?
                </p>
              </div>
              <Input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value.slice(0, 40))}
                placeholder="Your name"
                className="h-12 text-center text-base"
                maxLength={40}
              />
              <Button
                type="submit"
                disabled={!draft.trim()}
                className="h-12 w-full font-display text-[17px]
                           bg-gradient-to-r from-gold via-flamingo to-purple
                           text-white shadow-glow-pink
                           disabled:opacity-40 disabled:bg-none disabled:bg-white/10"
              >
                Join the party
              </Button>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
