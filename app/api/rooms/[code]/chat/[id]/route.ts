import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { chatMessages } from "@/lib/db/schema";
import { findRoomByCode } from "@/lib/rooms";
import { broadcastToRoom } from "@/lib/realtime-server";
import { guardSession } from "@/lib/server-session";
import { checkAndIncrement } from "@/lib/rate-limit";
import { toChatPayload } from "@/lib/chat-system";

// Per-message ops. The voter can:
//   - PATCH their own message within EDIT_WINDOW_MS to fix typos.
//   - (Deletion is intentionally not exposed; once it's out, it's out.
//     The DELETE handler stays for future admin moderation if needed.)
type RouteCtx = { params: Promise<{ code: string; id: string }> };

const EDIT_WINDOW_MS = 2 * 60 * 1000;

const PatchSchema = z.object({
  session: z.string().min(8).max(64),
  body: z.string().trim().min(1).max(2000),
});

export async function PATCH(req: Request, { params }: RouteCtx) {
  const { code, id } = await params;
  const room = await findRoomByCode(code);
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  const parsed = PatchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { session, body } = parsed.data;

  const guard = await guardSession(session);
  if (guard) return guard;

  // 20 edits per session per 10s — generous enough for a quick
  // back-to-back typo fix, tight enough to catch a scripted client
  // hammering UPDATEs against the 2000-char `body` column.
  const limited = await checkAndIncrement(
    `chatedit:${room.id}:${session}`,
    20,
    10_000,
  );
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Slow down — too many edits." },
      { status: 429 },
    );
  }

  const [msg] = await db
    .select()
    .from(chatMessages)
    .where(
      and(
        eq(chatMessages.id, id),
        eq(chatMessages.roomId, room.id),
        eq(chatMessages.sessionId, session),
      ),
    )
    .limit(1);
  if (!msg) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (msg.kind !== "text") {
    return NextResponse.json({ error: "Only text messages can be edited" }, { status: 400 });
  }
  const age = Date.now() - msg.createdAt.getTime();
  if (age > EDIT_WINDOW_MS) {
    return NextResponse.json(
      { error: "Edit window expired" },
      { status: 403 },
    );
  }

  // Stamp the edit into meta so clients can show "(edited)".
  const meta = {
    ...(msg.meta ?? {}),
    edited: true,
    editedAt: new Date().toISOString(),
  };

  const [updated] = await db
    .update(chatMessages)
    .set({ body, meta })
    .where(eq(chatMessages.id, id))
    .returning();

  // Dedicated `chat:edit` event with the full payload so listeners
  // can patch the row in place. The earlier `chat:react` ride-along
  // routed edits through the reaction refetch throttle and could
  // sit on a stale body for up to 600ms.
  await broadcastToRoom(code, {
    type: "chat:edit",
    id,
    message: toChatPayload(updated),
  });
  return NextResponse.json({ ok: true });
}

// Kept for future admin moderation, not surfaced in the UI.
export async function DELETE(req: Request, { params }: RouteCtx) {
  const { code, id } = await params;
  const room = await findRoomByCode(code);
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  const url = new URL(req.url);
  const session = url.searchParams.get("session");
  if (!session) return NextResponse.json({ error: "Missing session" }, { status: 400 });

  const guard = await guardSession(session);
  if (guard) return guard;

  const deleted = await db
    .delete(chatMessages)
    .where(
      and(
        eq(chatMessages.id, id),
        eq(chatMessages.roomId, room.id),
        eq(chatMessages.sessionId, session),
      ),
    )
    .returning({ id: chatMessages.id });

  if (deleted.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await broadcastToRoom(code, { type: "chat:delete", id });
  return NextResponse.json({ ok: true });
}
