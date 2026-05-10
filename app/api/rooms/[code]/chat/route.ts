import { NextResponse } from "next/server";
import { z } from "zod";
import { and, desc, eq, inArray, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { chatMessages, chatReactions, type ChatMessageKind } from "@/lib/db/schema";
import { findRoomByCode } from "@/lib/rooms";
import { broadcastToRoom } from "@/lib/liveblocks-server";
import { pushToRoom } from "@/lib/push";

// Per-room chat. GET returns a window of messages with their reactions
// folded in; POST inserts a new message and fans-out chat:new +
// best-effort push to subscribers whose prefs match.

type RouteCtx = { params: Promise<{ code: string }> };

const PostSchema = z.object({
  session: z.string().min(8).max(64),
  name: z.string().trim().min(1).max(40),
  avatarId: z.string().min(1).max(64).nullable().optional(),
  body: z.string().trim().max(2000).optional(),
  gifUrl: z.string().url().max(2000).optional(),
  replyTo: z.string().uuid().nullable().optional(),
  kind: z.enum(["text", "gif", "bingo_strike"]).optional().default("text"),
  meta: z.record(z.string(), z.unknown()).optional(),
});

const PAGE_SIZE = 50;

export async function GET(req: Request, { params }: RouteCtx) {
  const { code } = await params;
  const room = await findRoomByCode(code);
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  const url = new URL(req.url);
  const beforeIso = url.searchParams.get("before");
  const limit = Math.min(
    PAGE_SIZE,
    Number(url.searchParams.get("limit") ?? PAGE_SIZE),
  );

  // Fetch most-recent first then reverse — keeps the index seek cheap.
  const whereClause = beforeIso
    ? and(
        eq(chatMessages.roomId, room.id),
        lt(chatMessages.createdAt, new Date(beforeIso)),
      )
    : eq(chatMessages.roomId, room.id);

  const msgs = await db
    .select()
    .from(chatMessages)
    .where(whereClause)
    .orderBy(desc(chatMessages.createdAt))
    .limit(limit);

  const ids = msgs.map((m) => m.id);
  const reactions = ids.length
    ? await db
        .select()
        .from(chatReactions)
        .where(inArray(chatReactions.messageId, ids))
    : [];

  // Fold reactions into each message: { emoji → { count, names[], mine } }
  const byMsg = new Map<string, ReturnType<typeof foldEmpty>>();
  for (const m of msgs) byMsg.set(m.id, foldEmpty());
  const session = url.searchParams.get("session") ?? "";
  for (const r of reactions) {
    const e = byMsg.get(r.messageId);
    if (!e) continue;
    const slot = e[r.emoji] ?? { count: 0, names: [], mine: false };
    slot.count += 1;
    slot.names.push(r.name);
    if (r.sessionId === session) slot.mine = true;
    e[r.emoji] = slot;
  }

  return NextResponse.json({
    messages: msgs
      .slice()
      .reverse()
      .map((m) => ({
        id: m.id,
        sessionId: m.sessionId,
        name: m.name,
        avatarId: m.avatarId,
        kind: m.kind as ChatMessageKind,
        body: m.body,
        gifUrl: m.gifUrl,
        replyTo: m.replyTo,
        meta: m.meta,
        createdAt: m.createdAt.toISOString(),
        reactions: byMsg.get(m.id) ?? {},
      })),
  });
}

function foldEmpty(): Record<
  string,
  { count: number; names: string[]; mine: boolean }
> {
  return {};
}

export async function POST(req: Request, { params }: RouteCtx) {
  const { code } = await params;
  const room = await findRoomByCode(code);
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  const parsed = PostSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid body" },
      { status: 400 },
    );
  }
  const data = parsed.data;

  // Need at least one of: body, gifUrl, or a "card"-kind meta payload.
  const hasContent =
    (data.body && data.body.length > 0) ||
    (data.gifUrl && data.gifUrl.length > 0) ||
    (data.kind && data.kind !== "text");
  if (!hasContent) {
    return NextResponse.json({ error: "Message is empty" }, { status: 400 });
  }

  const [row] = await db
    .insert(chatMessages)
    .values({
      roomId: room.id,
      sessionId: data.session,
      name: data.name,
      avatarId: data.avatarId ?? null,
      kind: data.kind ?? "text",
      body: data.body ?? null,
      gifUrl: data.gifUrl ?? null,
      replyTo: data.replyTo ?? null,
      meta: data.meta ?? null,
    })
    .returning({ id: chatMessages.id });

  await broadcastToRoom(code, { type: "chat:new", id: row.id });

  // Push: chatAll subscribers OR (chatReplies && replyTo author === them).
  pushToRoom(
    room.id,
    (prefs, sub) => {
      // Don't notify the sender.
      if (sub.sessionId === data.session) return false;
      if (prefs.chatAll) return true;
      if (prefs.chatReplies && data.replyTo) {
        // chatReplies opt-in: we need to check whether the reply target
        // belongs to this subscriber. Skip the lookup here — server
        // does it once below for the union case.
        return false;
      }
      return false;
    },
    {
      title: data.name,
      body: data.body
        ? data.body.slice(0, 120)
        : data.gifUrl
          ? "Sent a GIF"
          : "New message",
      url: `/r/${code}/chat`,
      tag: `chat:${code}`,
    },
  ).catch(() => {});

  // Replies — fan separately to the original author only, if their prefs
  // allow it. Doing this with one query keeps the chatAll path clean.
  if (data.replyTo) {
    const [parent] = await db
      .select({ sessionId: chatMessages.sessionId })
      .from(chatMessages)
      .where(eq(chatMessages.id, data.replyTo))
      .limit(1);
    if (parent && parent.sessionId !== data.session) {
      pushToRoom(
        room.id,
        (prefs, sub) =>
          !!prefs.chatReplies && sub.sessionId === parent.sessionId,
        {
          title: `${data.name} replied to you`,
          body: data.body?.slice(0, 120) ?? "Tap to see the reply",
          url: `/r/${code}/chat`,
          tag: `chat-reply:${data.replyTo}`,
        },
      ).catch(() => {});
    }
  }

  return NextResponse.json({ ok: true, id: row.id });
}

export const dynamic = "force-dynamic";
