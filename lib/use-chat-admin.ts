"use client";

import { useEffect, useState } from "react";

// Client-side mirror of the server's chat-admin cookie. The cookie
// itself is httpOnly so JS can't see it; the server flips this
// localStorage flag from the chat POST response and dispatches a
// `uzk:chat-admin-change` window event so every component subscribed
// via `useChatAdmin()` re-renders. The flag is purely a UI hint —
// every delete request is re-validated server-side from the cookie,
// so a tampered localStorage grants nothing.

const KEY = "uzk_chat_admin";
const EVENT = "uzk:chat-admin-change";

function read(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

/** Reactive read of the chat-admin flag. Returns `false` on the
 *  server (and during the first client render) to keep hydration
 *  matching; the post-mount effect promotes to the real value and
 *  re-renders. Subscribes to `EVENT` so a grant landing in the chat
 *  panel light up the presence-bar dot in the same tick. */
export function useChatAdmin(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    setOn(read());
    const onChange = () => setOn(read());
    window.addEventListener(EVENT, onChange);
    // `storage` fires on OTHER tabs writing localStorage — keeps a
    // second open tab in sync if the moderator toggles in tab A.
    window.addEventListener("storage", (e) => {
      if (e.key === KEY) onChange();
    });
    return () => {
      window.removeEventListener(EVENT, onChange);
    };
  }, []);
  return on;
}

/** Set the flag and notify every subscriber in this tab. */
export function setChatAdmin(on: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (on) window.localStorage.setItem(KEY, "1");
    else window.localStorage.removeItem(KEY);
  } catch {
    /* private mode — UI hint just won't persist */
  }
  window.dispatchEvent(new Event(EVENT));
}
