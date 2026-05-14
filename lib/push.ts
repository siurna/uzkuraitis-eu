import webpush from "web-push";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { pushSubscriptions, type PushPrefs } from "@/lib/db/schema";

// One configure() per process. Throws at call time if VAPID keys are
// missing — push triggers are best-effort so callers should swallow
// thrown errors.
let configured = false;
function ensureConfigured() {
  if (configured) return;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:tomas@uzkuraitis.eu";
  if (!pub || !priv) {
    throw new Error(
      "VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY missing. Run " +
        "`npx web-push generate-vapid-keys` and put them in .env.",
    );
  }
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
}

export type PushPayload = {
  title: string;
  body?: string;
  url?: string;
  tag?: string;
  /** Same-origin path to a hero image shown in the notification. */
  image?: string;
};

/** A push payload as a function of the subscriber's UI language.
 *  Lets the sender express "render the title / body in their lang,
 *  not mine" without baking the resolved strings into the
 *  broadcast. The caller supplies a builder; pushToRoom invokes it
 *  per subscriber with that subscriber's saved `lang` (falls back
 *  to LT, the app default). */
export type PushPayloadFor = (lang: "en" | "lt") => PushPayload;

// Per-request memo for the room's subscription roster — the same
// chat POST commonly fans out three push waves (chatAll / mentions /
// replies) and they were each running an identical SELECT. With
// this cache the second and third call hit memory. Cleared between
// requests because the lambda warm-instance object stays in scope
// only while the route handler is awaiting.
const roomSubsCache = new Map<
  string,
  { rows: (typeof pushSubscriptions.$inferSelect)[]; until: number }
>();
const ROOM_SUBS_TTL_MS = 5_000;

async function readRoomSubs(roomId: string) {
  const hit = roomSubsCache.get(roomId);
  const now = Date.now();
  if (hit && hit.until > now) return hit.rows;
  const rows = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.roomId, roomId));
  roomSubsCache.set(roomId, { rows, until: now + ROOM_SUBS_TTL_MS });
  return rows;
}

// Fan out a payload to every subscription in a room whose `prefs`
// pass the given filter. Filter is a thunk so callers can read fields
// of the subscription (e.g. reply-to: msg.replyTo === session) without
// SQL gymnastics. Best-effort: 410/404 endpoints are deleted, other
// errors logged + swallowed.
export async function pushToRoom(
  roomId: string,
  filter: (prefs: PushPrefs, sub: typeof pushSubscriptions.$inferSelect) => boolean,
  payload: PushPayload | PushPayloadFor,
): Promise<void> {
  try {
    ensureConfigured();
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[push]", (err as Error).message);
    }
    return;
  }

  const subs = await readRoomSubs(roomId);

  const eligible = subs.filter((s) => filter(s.prefs as PushPrefs, s));
  if (eligible.length === 0) return;

  const isFn = typeof payload === "function";
  await Promise.all(
    eligible.map(async (s) => {
      // Render the payload in this subscriber's saved UI language.
      // LT is the app default, so a null `lang` column falls back
      // to it. Sender-side caching of the resolved string is fine
      // because every notification is a distinct send anyway.
      const lang = (s.lang === "en" ? "en" : "lt") as "en" | "lt";
      const body = isFn ? (payload as PushPayloadFor)(lang) : (payload as PushPayload);
      const json = JSON.stringify(body);
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          },
          json,
        );
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          // Subscription is dead, drop it.
          await db
            .delete(pushSubscriptions)
            .where(eq(pushSubscriptions.id, s.id))
            .catch(() => {});
        } else if (process.env.NODE_ENV !== "production") {
          console.warn("[push] send failed", status, err);
        }
      }
    }),
  );
}

// Helper: VAPID public key for the client to subscribe with. Safe to
// expose — push docs literally tell you to ship it to the browser.
export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY ?? null;
}
