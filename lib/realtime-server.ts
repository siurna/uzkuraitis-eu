import type { RoomEvent } from "@/lib/realtime";
import { serverBroadcast } from "@/lib/supabase";

// Server-side fire-and-forget broadcast. The argument is the RoomEvent
// union from lib/realtime.tsx so a missing required field on the
// payload trips TS at the call site, not in production. Errors get
// swallowed inside serverBroadcast — broadcasts are hints, not
// durable writes, and the row is already on disk by the time we get
// here.
export async function broadcastToRoom(
  roomCode: string,
  event: RoomEvent,
): Promise<void> {
  await serverBroadcast(
    `room:${roomCode}`,
    "msg",
    event as unknown as Record<string, unknown>,
  );
}
