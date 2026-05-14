"use client";

import { useMemo } from "react";
import { motion } from "motion/react";
import { useOthers, useSelf } from "@/lib/realtime";
import { getAvatar } from "@/lib/avatars";
import { optimizedSrc } from "@/lib/img";
import { ensureSessionId } from "@/lib/use-identity";
import { useProfile } from "@/components/profile-sheet";
import { t } from "@/lib/i18n";
import { useLang } from "@/lib/i18n-client";

// Home widget: the party, made visible. Everyone currently in the room
// shows up as an avatar bubble in a loose honeycomb that drifts/bobs
// gently (it's meant to feel alive — not a heart-beat pulse), with a
// "···" tag while they're typing in chat and their last floating-reaction
// emoji popping up over their head. Reads straight off Liveblocks
// presence — no DB, no API.
//
// Tapping a bubble opens that participant's profile drawer.

type Person = {
  key: string;
  name: string;
  avatarId: string | null;
  emoji: string | null;
  typing: boolean;
  isSelf: boolean;
  /** Their stable browser-session id (set in presence by the name gate).
   *  May be null for older clients that haven't upgraded; in that case
   *  the bubble is non-tappable. */
  sessionId: string | null;
};

// Cheap deterministic hue from a name → the no-photo bubble fill, so a
// given person always gets the same colour.
function hueFrom(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}

export function WhosHere() {
  const lang = useLang();
  const self = useSelf();
  const others = useOthers();
  const { open: openProfile } = useProfile();

  const people = useMemo<Person[]>(() => {
    const list: Person[] = [];
    if (self?.presence.name) {
      list.push({
        key: "self",
        name: self.presence.name,
        avatarId: self.presence.avatar ?? null,
        emoji: self.presence.emoji ?? null,
        typing: !!self.presence.typing,
        isSelf: true,
        sessionId: self.presence.sessionId ?? ensureSessionId(),
      });
    }
    for (const o of others) {
      if (!o.presence.name) continue; // still on the name gate
      list.push({
        key: `c${o.connectionId}`,
        name: o.presence.name,
        avatarId: o.presence.avatar ?? null,
        emoji: o.presence.emoji ?? null,
        typing: !!o.presence.typing,
        isSelf: false,
        sessionId: o.presence.sessionId ?? null,
      });
    }
    return list;
  }, [self, others]);

  if (people.length === 0) return null;

  return (
    <div className="container mx-auto max-w-3xl px-4">
      <div
        className="relative overflow-hidden rounded-3xl px-4 pt-4 pb-6"
        style={{ background: "radial-gradient(130% 130% at 12% -10%, #00b8b0 0%, #0a5a66 38%, #07303f 100%)" }}
      >
        {/* a faint dotted constellation behind the bubbles */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.16]"
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,0.7) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />
        <p className="relative text-[10px] uppercase tracking-[0.3em] font-display text-white/75 mb-3">
          {t(lang, "whos_here_title", people.length)}
        </p>
        <ul className="relative flex flex-wrap items-start justify-center gap-x-2 gap-y-1">
          {people.map((p, i) => (
            <li key={p.key} className={i % 2 ? "mt-4" : ""}>
              <Bubble
                person={p}
                index={i}
                onOpen={() =>
                  p.sessionId &&
                  openProfile(p.sessionId, { name: p.name, avatarId: p.avatarId })
                }
              />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Bubble({
  person,
  index,
  onOpen,
}: {
  person: Person;
  index: number;
  onOpen: () => void;
}) {
  const avatar = person.avatarId ? getAvatar(person.avatarId) : null;
  const photo = avatar?.photo ?? null;
  // Each bubble drifts on its own clock so the cluster looks alive
  // rather than marching in step. The bob runs on the GPU-friendly
  // CSS keyframe `whos-bob` (globals.css) instead of a motion-react
  // infinite tween — for a 50-person room that's 50 fewer JS-driven
  // animations on every frame. On a mid-range Android (~3 GB RAM,
  // weak GPU) it's the difference between butter and jank.
  const dur = 3 + (index % 5) * 0.45;
  const delay = (index % 7) * 0.22;
  const rot = index % 2 ? 3 : -3;
  const canOpen = person.sessionId != null;

  return (
    <div
      className="relative motion-safe:[animation:whos-bob_var(--bob-dur)_ease-in-out_infinite] motion-safe:[animation-delay:var(--bob-delay)]"
      style={
        {
          "--bob-dur": `${dur}s`,
          "--bob-delay": `${delay}s`,
          "--bob-rot": `${rot}deg`,
        } as React.CSSProperties
      }
    >
      <button
        type="button"
        onClick={onOpen}
        disabled={!canOpen}
        aria-label={person.name}
        className={`relative h-11 w-11 rounded-full overflow-hidden ring-2 bg-dark-blue-800 transition transform-gpu
                    active:scale-[0.92] disabled:cursor-default
                    ${person.isSelf ? "ring-flamingo" : "ring-white/15"}
                    ${canOpen ? "hover:ring-white/35" : ""}`}
      >
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={optimizedSrc(photo, 128)}
            alt=""
            className="h-full w-full object-cover"
            style={{ objectPosition: avatar?.focal ? `${avatar.focal.x}% ${avatar.focal.y}%` : "50% 30%" }}
          />
        ) : (
          <div
            className="h-full w-full grid place-items-center font-display text-sm text-white"
            style={{ background: `hsl(${hueFrom(person.name)} 52% 30%)` }}
          >
            {person.name.charAt(0).toUpperCase()}
          </div>
        )}
      </button>

      {/* Thought bubble: typing dots take priority, otherwise the last
          reaction emoji this person sent. */}
      {person.typing ? (
        <span className="pointer-events-none absolute -top-2.5 left-1/2 -translate-x-1/2 flex items-center gap-0.5 rounded-full bg-white/12 ring-1 ring-white/15 px-1.5 py-1 backdrop-blur-sm">
          {[0, 1, 2].map((d) => (
            <motion.span
              key={d}
              className="h-1 w-1 rounded-full bg-white/80"
              animate={{ opacity: [0.25, 1, 0.25], y: [0, -1.5, 0] }}
              transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut", delay: d * 0.15 }}
            />
          ))}
        </span>
      ) : person.emoji ? (
        <motion.span
          key={person.emoji}
          initial={{ scale: 0, y: 4 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 18 }}
          className="pointer-events-none absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-white/10 ring-1 ring-white/15 px-1.5 py-0.5 text-sm leading-none backdrop-blur-sm"
        >
          {person.emoji}
        </motion.span>
      ) : null}
    </div>
  );
}
