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

// CACHE is auto-stamped on every production build by
// `scripts/stamp-sw.mjs` (wired in as the `prebuild` script), which
// replaces the version slug below with the deploying commit SHA
// (e.g. esc-2026-3c4171c). That means every Vercel deploy ships a
// fresh CACHE name, the `activate` handler below wipes the prior
// deploy's cache on first run, and PWAs in the wild flush their
// stale bundles automatically on next reload — critical for hot
// fixes during a live show. The literal value committed here is
// the local-dev fallback; do not hand-bump it for prod.
const CACHE = "esc-2026-v7";
// Icons live on a Supabase bucket now (see app/manifest.ts), so the
// precache list only carries first-party static assets. The bucket
// CDN handles the icon URLs on its own and we don't want a precache
// miss on a third-party host to blow up the install step.
const PRECACHE = [
  "/",
  "/images/70-heart.webp",
  "/images/70-heart-sm.webp",
  "/images/70-logo@2x.webp",
  "/images/participant-backdrop@2x.webp",
];
// Same bucket app/layout.tsx + app/manifest.ts use. Icons attached to
// push notifications still need a URL the OS can fetch; pointing
// straight at the bucket keeps things consistent and avoids us
// shipping the binary in /public.
const ICON_BUCKET =
  "https://mbgkujipbdfsdvjobtrf.supabase.co/storage/v1/object/public/icons";
const NOTIFICATION_ICON = `${ICON_BUCKET}/icon-192.png`;
const NOTIFICATION_BADGE = `${ICON_BUCKET}/icon-192.png`;

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
  // Next.js App Router fires RSC (React Server Component) fetches to
  // the SAME page URL with `?_rsc=...` query strings, mode "cors".
  // Those aren't "navigate" so the rule above doesn't catch them; the
  // RSC header is the deterministic signal. If we cache/intercept
  // them and one fails, the page module graph collapses and the
  // Supabase client never gets a chance to open its websocket. Let
  // them go straight to the network.
  if (req.headers.get("RSC") === "1") return;
  if (url.searchParams.has("_rsc")) return;
  // Only cache real static assets — anything else (RSC streams, data
  // fetches, etc) skips the SW entirely. Without this gate a failed
  // cors fetch would fall into the cache-miss catch below and we'd
  // hand respondWith an undefined value.
  const STATIC_EXT = /\.(?:js|css|woff2?|ttf|otf|webp|png|jpe?g|svg|ico|gif|json|mp3|mp4|webm)$/i;
  if (!STATIC_EXT.test(url.pathname)) return;

  // Cache-first for static assets, network fallback that fills cache.
  // CRITICAL: every branch of this Promise chain MUST resolve to a
  // valid Response — service workers throw "Failed to convert value
  // to 'Response'" if respondWith ever sees undefined, and that kills
  // every fetch the SW is intercepting downstream (including the JS
  // chunks the app needs to wire up its websocket).
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
        .catch(() => hit ?? Response.error());
    }),
  );
});

// --- Web Push ----------------------------------------------------------

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "Eurovision", body: event.data?.text() ?? "" };
  }
  const title = payload.title || "Eurovision";
  const body = payload.body || "";
  const tag = payload.tag || undefined;
  const data = { url: payload.url || "/", ...payload };
  const isReplyToMe = typeof tag === "string" && tag.startsWith("chat-reply:");

  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const focused = wins.find((c) => c.focused);
      if (focused) {
        // The app is open & in front. Only surface a reply-to-me, and
        // only if they're not already sitting in the chat tab.
        let onChat = false;
        try {
          onChat = /\/r\/[^/]+\/chat/.test(new URL(focused.url).pathname);
        } catch {
          /* ignore */
        }
        if (!(isReplyToMe && !onChat)) return; // everything else: stay quiet
      }
      return self.registration.showNotification(title, {
        body,
        icon: NOTIFICATION_ICON,
        badge: NOTIFICATION_BADGE,
        image: payload.image || undefined,
        tag,
        renotify: !!tag,
        data,
      });
    })(),
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
