import { Liveblocks } from "@liveblocks/node";
import type { RoomEvent } from "@/lib/liveblocks";

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

// Fire-and-forget broadcast. The parameter type is the RoomEvent union
// (lib/liveblocks.ts) so any call site that forgets a required field
// fails at compile time. The cast at the Liveblocks boundary is the one
// place we lie to TS — RoomEvent payloads are JSON-clean by construction.
export async function broadcastToRoom(
  roomCode: string,
  event: RoomEvent,
): Promise<void> {
  const lb = getLiveblocksServer();
  if (!lb) return;
  try {
    await lb.broadcastEvent(
      `room:${roomCode}`,
      event as Parameters<typeof lb.broadcastEvent>[1],
    );
  } catch (err) {
    console.warn("[liveblocks] broadcast failed:", err);
  }
}
