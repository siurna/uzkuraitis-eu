"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useUpdateMyPresence } from "@/lib/liveblocks";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AvatarPicker } from "@/components/avatar-picker";

const NAME_KEY = "uzk_name";
const AVATAR_KEY = "uzk_avatar";

// Modal-style overlay that asks the user for a display name + avatar on
// first entry to a room. Both persist to localStorage so the prompt only
// shows once per device. Voting form reads the same keys.
export function NameGate({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftAvatar, setDraftAvatar] = useState<string | null>(null);
  const updatePresence = useUpdateMyPresence();

  useEffect(() => {
    const storedName = localStorage.getItem(NAME_KEY);
    const storedAvatar = localStorage.getItem(AVATAR_KEY);
    if (storedName) setName(storedName);
    if (storedAvatar) setAvatar(storedAvatar);
    setHydrated(true);
  }, []);

  // Mirror name + avatar into Liveblocks presence so the rest of the room
  // sees the right tile against your initial.
  useEffect(() => {
    if (name) updatePresence({ name, avatar });
  }, [name, avatar, updatePresence]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = draftName.trim().slice(0, 40);
    if (!cleanName) return;
    localStorage.setItem(NAME_KEY, cleanName);
    if (draftAvatar) {
      localStorage.setItem(AVATAR_KEY, draftAvatar);
    } else {
      localStorage.removeItem(AVATAR_KEY);
    }
    setName(cleanName);
    setAvatar(draftAvatar);
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
              className="glass-card w-full max-w-md rounded-2xl p-6 flex flex-col gap-4"
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
                value={draftName}
                onChange={(e) => setDraftName(e.target.value.slice(0, 40))}
                placeholder="Your name"
                className="h-12 text-center text-base"
                maxLength={40}
              />
              <AvatarPicker value={draftAvatar} onChange={setDraftAvatar} />
              <Button
                type="submit"
                disabled={!draftName.trim()}
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
