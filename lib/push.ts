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

// Fan out a payload to every subscription in a room whose `prefs`
// pass the given filter. Filter is a thunk so callers can read fields
// of the subscription (e.g. reply-to: msg.replyTo === session) without
// SQL gymnastics. Best-effort: 410/404 endpoints are deleted, other
// errors logged + swallowed.
export async function pushToRoom(
  roomId: string,
  filter: (prefs: PushPrefs, sub: typeof pushSubscriptions.$inferSelect) => boolean,
  payload: PushPayload,
): Promise<void> {
  try {
    ensureConfigured();
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[push]", (err as Error).message);
    }
    return;
  }

  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.roomId, roomId));

  const eligible = subs.filter((s) => filter(s.prefs as PushPrefs, s));
  if (eligible.length === 0) return;

  const json = JSON.stringify(payload);
  await Promise.all(
    eligible.map(async (s) => {
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
