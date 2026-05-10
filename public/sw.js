/* Service worker for the Eurovision 2026 PWA.
 *
 * Two jobs:
 *   1. Cache Next's static asset bundle + fonts + brand images so the
 *      app launches fast offline.  Explicitly skips /api/* and HTML —
 *      votes / chat / scores must always be fresh.
 *   2. Render Web Push notifications when the server fans an event
 *      out to a subscriber whose tab is backgrounded.
 *
 * Keep this file vanilla JS — service workers don't get a Next compile
 * step, and we want the SW to load instantly without a bundler.
 */

const CACHE = "esc-2026-v1";
const PRECACHE = [
  "/",
  "/icon.png",
  "/images/70-heart.webp",
  "/images/70-heart-sm.webp",
  "/images/70-logo@2x.webp",
  "/images/participant-backdrop@2x.webp",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Same-origin only; never touch API routes or auth endpoints; HTML
  // navigations go straight to network so we always get fresh content.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;
  if (url.pathname.startsWith("/admin")) return;
  if (req.mode === "navigate") return;

  // Cache-first for static assets, network fallback that fills cache.
  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req)
        .then((res) => {
          if (!res || res.status !== 200 || res.type !== "basic") return res;
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(req, clone)).catch(() => {});
          return res;
        })
        .catch(() => hit);
    }),
  );
});

// --- Web Push ----------------------------------------------------------

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "Eurovision 2026", body: event.data?.text() ?? "" };
  }
  const title = payload.title || "Eurovision 2026";
  const body = payload.body || "";
  const tag = payload.tag || undefined;
  const data = { url: payload.url || "/", ...payload };

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icon.png",
      badge: "/icon.png",
      tag,
      data,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification?.data?.url || "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const c of clients) {
          if (c.url.includes(target) && "focus" in c) return c.focus();
        }
        if (self.clients.openWindow) return self.clients.openWindow(target);
        return undefined;
      }),
  );
});
