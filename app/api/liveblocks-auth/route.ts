import { Liveblocks } from "@liveblocks/node";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { findRoomByCode } from "@/lib/rooms";
import { nanoid } from "nanoid";

// Accept either the official LIVEBLOCKS_SECRET_KEY (current name) or
// LIVEBLOCKS_PRIVATE_KEY (legacy / dashboard label). Either is the sk_… key.
// Lazy init so `next build`'s page-data collection pass (which runs without
// env vars) doesn't choke on the SDK's strict secret-prefix check.
function getLiveblocks(): Liveblocks | null {
  const secret =
    process.env.LIVEBLOCKS_SECRET_KEY ?? process.env.LIVEBLOCKS_PRIVATE_KEY;
  if (!secret || !secret.startsWith("sk_")) return null;
  return new Liveblocks({ secret });
}

const PRESENCE_PALETTE = [
  "#ff4fb5", "#7ce0d8", "#f7c948", "#7dd3fc",
  "#fb923c", "#a78bfa", "#34d399", "#f472b6",
];

function colorForId(id: string): string {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return PRESENCE_PALETTE[Math.abs(hash) % PRESENCE_PALETTE.length];
}

export async function POST(request: Request) {
  const liveblocks = getLiveblocks();
  if (!liveblocks) {
    return NextResponse.json(
      {
        error:
          "Liveblocks is not configured. Set LIVEBLOCKS_SECRET_KEY (or LIVEBLOCKS_PRIVATE_KEY) to your sk_… key.",
      },
      { status: 503 },
    );
  }

  const { room: liveblocksRoom } = (await request.json()) as { room?: string };
  if (!liveblocksRoom?.startsWith("room:")) {
    return NextResponse.json({ error: "Invalid room id" }, { status: 400 });
  }
  const roomCode = liveblocksRoom.slice("room:".length).toUpperCase();

  // Verify the requested room actually exists in our DB. Without this anyone
  // could connect to any Liveblocks room they can guess; with it the code is
  // effectively the shared secret.
  const room = await findRoomByCode(roomCode);
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  // Stable per-browser identity for presence — read from a cookie so reactions
  // and presence stay consistent if the user reloads.
  const jar = await cookies();
  let userId = jar.get("uzk_uid")?.value;
  if (!userId) {
    userId = `u_${nanoid(12)}`;
    // Cookie is set on the response below.
  }

  const displayName = jar.get("uzk_name")?.value ?? "Guest";

  const session = liveblocks.prepareSession(userId, {
    userInfo: { name: displayName, color: colorForId(userId) },
  });
  session.allow(`room:${roomCode}`, session.FULL_ACCESS);

  const { status, body } = await session.authorize();

  const response = new NextResponse(body, { status });
  if (!jar.get("uzk_uid")) {
    response.cookies.set("uzk_uid", userId, {
      httpOnly: false,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
  }
  return response;
}
