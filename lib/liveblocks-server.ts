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

// JSON-shaped payloads only (Liveblocks type-checks against its own Json
// alias). Callers pass plain objects/arrays of primitives.
type JsonPayload =
  | string
  | number
  | boolean
  | null
  | JsonPayload[]
  | { [k: string]: JsonPayload };

// Fire-and-forget helper. Logs failures but never throws so the calling
// route doesn't fail just because the realtime hint couldn't be sent.
export async function broadcastToRoom(
  roomCode: string,
  data: JsonPayload,
): Promise<void> {
  const lb = getLiveblocksServer();
  if (!lb) return;
  try {
    await lb.broadcastEvent(`room:${roomCode}`, data);
  } catch (err) {
    console.warn("[liveblocks] broadcast failed:", err);
  }
}
