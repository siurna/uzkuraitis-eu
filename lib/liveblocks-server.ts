import { Liveblocks } from "@liveblocks/node";

// Lazy-instantiated server-side Liveblocks client used to push events from
// route handlers (e.g. broadcasting "scores:updated" after a vote is saved).
// Returns null if the secret key isn't configured so callers can no-op
// instead of crashing the request.
let cached: Liveblocks | null = null;

export function getLiveblocksServer(): Liveblocks | null {
  if (cached) return cached;
  const secret =
    process.env.LIVEBLOCKS_SECRET_KEY ?? process.env.LIVEBLOCKS_PRIVATE_KEY;
  if (!secret || !secret.startsWith("sk_")) return null;
  cached = new Liveblocks({ secret });
  return cached;
}

// Fire-and-forget helper. Logs failures but never throws so the calling
// route doesn't fail just because the realtime hint couldn't be sent.
// The Liveblocks Node client narrows to its internal Json type at the
// call boundary; we accept any JSON-shaped object so callers don't have
// to fight TS over Record<string, unknown> meta fields.
type JsonValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | JsonValue[]
  | { [k: string]: JsonValue | unknown };

export async function broadcastToRoom(
  roomCode: string,
  data: JsonValue,
): Promise<void> {
  const lb = getLiveblocksServer();
  if (!lb) return;
  try {
    await lb.broadcastEvent(`room:${roomCode}`, data as Parameters<typeof lb.broadcastEvent>[1]);
  } catch (err) {
    console.warn("[liveblocks] broadcast failed:", err);
  }
}
