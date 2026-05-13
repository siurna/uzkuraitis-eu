// Client-side push helpers. Wraps the SW registration + the
// PushManager + a small subscribe/unsubscribe API surface. Never throws
// — every method returns a discriminated result so callers can render
// a friendly "not supported" / "permission denied" message.

export type { PushPrefs } from "@/lib/push-prefs";
import type { PushPrefs } from "@/lib/push-prefs";

export type PushState =
  | { kind: "unsupported" }
  | { kind: "blocked" }
  | { kind: "off"; vapidKey: string | null }
  | { kind: "on"; vapidKey: string; prefs: PushPrefs };

export function isSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

export async function registerSw(): Promise<ServiceWorkerRegistration | null> {
  if (!isSupported()) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js");
  } catch {
    return null;
  }
}

// VAPID public keys arrive as base64url; PushManager wants Uint8Array.
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normal = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normal);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function getState(roomCode: string, session: string): Promise<PushState> {
  if (!isSupported()) return { kind: "unsupported" };
  if (Notification.permission === "denied") return { kind: "blocked" };

  const res = await fetch(
    `/api/rooms/${roomCode}/push/subscribe?session=${encodeURIComponent(session)}`,
    { cache: "no-store" },
  );
  if (!res.ok) return { kind: "off", vapidKey: null };
  const data = (await res.json()) as {
    vapidKey: string | null;
    subscribed: boolean;
    prefs: PushPrefs;
  };
  if (!data.subscribed || !data.vapidKey) {
    return { kind: "off", vapidKey: data.vapidKey };
  }
  return { kind: "on", vapidKey: data.vapidKey, prefs: data.prefs };
}

export async function subscribe(
  roomCode: string,
  session: string,
  name: string,
  prefs: PushPrefs,
  vapidKey: string,
): Promise<boolean> {
  if (!isSupported()) return false;
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return false;
  const reg = (await navigator.serviceWorker.ready) ?? (await registerSw());
  if (!reg) return false;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      // Cast: PushManager wants BufferSource over a plain ArrayBuffer,
      // but TS 5.x narrows our Uint8Array<ArrayBufferLike> too far.
      applicationServerKey: urlBase64ToUint8Array(vapidKey)
        .buffer as ArrayBuffer,
    });
  }
  const json = sub.toJSON() as {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  };
  const res = await fetch(`/api/rooms/${roomCode}/push/subscribe`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      session,
      name,
      subscription: json,
      prefs,
    }),
  });
  return res.ok;
}

export async function updatePrefs(
  roomCode: string,
  session: string,
  prefs: PushPrefs,
): Promise<boolean> {
  const res = await fetch(`/api/rooms/${roomCode}/push/subscribe`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ session, prefs }),
  });
  return res.ok;
}

export async function unsubscribe(
  roomCode: string,
  session: string,
): Promise<boolean> {
  if (isSupported()) {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) await sub.unsubscribe().catch(() => {});
  }
  const res = await fetch(
    `/api/rooms/${roomCode}/push/subscribe?session=${encodeURIComponent(session)}`,
    { method: "DELETE" },
  );
  return res.ok;
}
