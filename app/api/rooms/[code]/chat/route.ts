import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { and, desc, eq, inArray, lt, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { chatMessages, chatReactions, type ChatMessageKind } from "@/lib/db/schema";
import { findRoomByCode } from "@/lib/rooms";
import { broadcastToRoom } from "@/lib/realtime-server";
import { pushToRoom } from "@/lib/push";
import { guardSession } from "@/lib/server-session";
import { checkAndIncrement } from "@/lib/rate-limit";
import { toChatPayload } from "@/lib/chat-system";
import {
  CHAT_ADMIN_COOKIE,
  chatAdminSecret,
  constantTimeEqual,
} from "@/lib/chat-admin";
import { t } from "@/lib/i18n";

// Grapheme-safe truncation for push notification bodies. JS string
// `slice` cuts by 16-bit code unit, which can split a flag (two
// surrogate pairs), a skin-toned emoji (5+ codepoints), or a ZWJ
// family glyph into a U+FFFD replacement char. `Intl.Segmenter` —
// available everywhere Next 16 runs — splits on graphemes so the
// last visible glyph stays intact. Falls back to char-slice for
// the (impossible) case where Segmenter isn't shipped.
function truncateForPush(body: string, max = 120): string {
  if (body.length <= max) return body;
  try {
    const seg = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    let out = "";
    for (const { segment } of seg.segment(body)) {
      if (out.length + segment.length > max) break;
      out += segment;
    }
    return out;
  } catch {
    return body.slice(0, max);
  }
}

// Per-room chat. GET returns a window of messages with their reactions
// folded in; POST inserts a new message and fans-out chat:new +
// best-effort push to subscribers whose prefs match.

type RouteCtx = { params: Promise<{ code: string }> };

const PostSchema = z.object({
  // Reject the two reserved session strings used internally for system
  // / commentator posts so a client can't impersonate them.
  session: z.string().min(8).max(64).refine(
    (s) => s !== "system" && s !== "commentator",
    { message: "Reserved session id" },
  ),
  name: z.string().trim().min(1).max(40),
  avatarId: z.string().min(1).max(64).nullable().optional(),
  body: z.string().trim().max(2000).optional(),
  gifUrl: z.string().url().max(2000).optional(),
  replyTo: z.string().uuid().nullable().optional(),
  kind: z.enum(["text", "gif", "image", "bingo_strike"]).optional().default("text"),
  meta: z.record(z.string(), z.unknown()).optional(),
  // Names the sender @-mentioned (computed client-side from known
  // participants). Used for targeted push only.
  mentions: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
});

const PAGE_SIZE = 50;

// Token-bucket caps live in the DB now (lib/rate-limit.ts) — durable
// across warm instances. 12 messages per 10 seconds per session is the
// floor; spam past that returns 429.
const CHAT_RATE_MAX = 12;
const CHAT_RATE_WINDOW_MS = 10_000;

export async function GET(req: Request, { params }: RouteCtx) {
  const { code } = await params;
  const room = await findRoomByCode(code);
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  const url = new URL(req.url);
  const beforeIso = url.searchParams.get("before");
  // Optional id cursor companion to the timestamp cursor. Together
  // they form a (createdAt, id) tuple cursor so two messages with
  // an identical millisecond (system + user posted in the same
  // transaction, e.g.) page cleanly — without this, the second of
  // the tied pair was silently dropped on the next "load earlier".
  const beforeId = url.searchParams.get("beforeId");
  const limit = Math.min(
    PAGE_SIZE,
    Number(url.searchParams.get("limit") ?? PAGE_SIZE),
  );

  // Fetch most-recent first then reverse — keeps the index seek
  // cheap. Cursor is (createdAt DESC, id DESC) when both sides are
  // present, falling back to plain createdAt < ? when only the
  // timestamp is provided (older clients).
  const whereClause = beforeIso
    ? beforeId
      ? and(
          eq(chatMessages.roomId, room.id),
          or(
            lt(chatMessages.createdAt, new Date(beforeIso)),
            and(
              eq(chatMessages.createdAt, new Date(beforeIso)),
              lt(chatMessages.id, beforeId),
            ),
          ),
        )
      : and(
          eq(chatMessages.roomId, room.id),
          lt(chatMessages.createdAt, new Date(beforeIso)),
        )
    : eq(chatMessages.roomId, room.id);

  const msgs = await db
    .select()
    .from(chatMessages)
    .where(whereClause)
    .orderBy(desc(chatMessages.createdAt), desc(chatMessages.id))
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

  const res = NextResponse.json({
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
  // Short edge cache for the cold-start chat fetch on tab open. The
  // chat:new broadcast fans out the moment anything lands, so live
  // freshness is never gated on this header — but the very first
  // GET after a viewer opens the room can hit the edge instead of
  // origin. `s-maxage=2` is short enough that a tab-switch a few
  // seconds in still feels live; SWR keeps it warm for 10s.
  res.headers.set(
    "Cache-Control",
    "public, s-maxage=2, stale-while-revalidate=10",
  );
  return res;
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

  // Cookie must vouch for the session the client claims to be.
  const guard = await guardSession(data.session);
  if (guard) return guard;

  // Moderator powerup. If the typed body matches the server-known
  // secret, intercept it: toggle the httpOnly cookie that the DELETE
  // route checks, never insert the message into chat. The body never
  // hits the database, never broadcasts, never appears anywhere — so
  // even if someone happens to type it in a real conversation it just
  // silently flips their mod state and the rest of the room sees
  // nothing. Returns `adminGranted: true` / `adminRevoked: true` so
  // the client can update its localStorage UI hint + show a toast.
  const secret = chatAdminSecret();
  if (secret && data.body && constantTimeEqual(data.body.trim(), secret)) {
    const jar = await cookies();
    const existing = jar.get(CHAT_ADMIN_COOKIE)?.value ?? null;
    const wasAdmin = existing != null && constantTimeEqual(existing, secret);
    if (wasAdmin) {
      jar.delete(CHAT_ADMIN_COOKIE);
      return NextResponse.json({ ok: true, adminRevoked: true });
    }
    // 30-day cookie, httpOnly so JS can't read it (the source of
    // truth lives here; localStorage on the client is a UI hint).
    // sameSite=lax so reload + same-origin nav keeps it; the chat
    // panel never makes cross-site fetches that would need 'none'.
    jar.set(CHAT_ADMIN_COOKIE, secret, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return NextResponse.json({ ok: true, adminGranted: true });
  }

  const rl = await checkAndIncrement(
    `chat:${room.id}:${data.session}`,
    CHAT_RATE_MAX,
    CHAT_RATE_WINDOW_MS,
  );
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many messages — slow down." }, { status: 429 });
  }

  // Need at least one of: body, gifUrl, or a "card"-kind meta payload.
  const hasContent =
    (data.body && data.body.length > 0) ||
    (data.gifUrl && data.gifUrl.length > 0) ||
    (data.kind && data.kind !== "text");
  if (!hasContent) {
    return NextResponse.json({ error: "Message is empty" }, { status: 400 });
  }

  // PERF: replyTo used to be checked twice — once here for in-room
  // validation, once below to pull the parent's sessionId for the
  // reply-push fan-out. One query returns both; the sessionId is
  // captured and reused below.
  let replyTargetSession: string | null = null;
  if (data.replyTo) {
    const [parent] = await db
      .select({ roomId: chatMessages.roomId, sessionId: chatMessages.sessionId })
      .from(chatMessages)
      .where(eq(chatMessages.id, data.replyTo))
      .limit(1);
    if (!parent || parent.roomId !== room.id) {
      return NextResponse.json(
        { error: "That reply target isn't in this room" },
        { status: 400 },
      );
    }
    replyTargetSession = parent.sessionId;
  }

  const finalMeta = room.nowPlayingCode
    ? { ...(data.meta ?? {}), nowPlaying: room.nowPlayingCode }
    : (data.meta ?? null);

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
      meta: finalMeta,
    })
    .returning();

  // Embed the full message inline so every connected client can append
  // without a follow-up GET — drops the refetch storm under hype-moment
  // load. `reactions` is always empty for a brand-new row.
  await broadcastToRoom(code, {
    type: "chat:new",
    id: row.id,
    message: toChatPayload(row),
  });

  // Push: chatAll subscribers. The mention + reply fan-outs below
  // handle their own narrower targeting. The body is built per
  // subscriber language; the title stays the sender's name (proper
  // noun, no translation needed).
  pushToRoom(
    room.id,
    (prefs, sub) => sub.sessionId !== data.session && !!prefs.chatAll,
    (lang) => ({
      title: data.name,
      body: data.body
        ? truncateForPush(data.body)
        : data.kind === "image"
          ? t(lang, "push_chat_photo")
          : data.kind === "gif"
            ? t(lang, "push_chat_gif")
            : t(lang, "push_chat_new"),
      url: `/r/${code}/chat`,
      tag: `chat:${code}`,
    }),
  ).catch(() => {});

  // @-mentions — notify the named people (matched on the name they
  // subscribed with), unless they'd already get a chatAll push.
  if (data.mentions && data.mentions.length > 0) {
    const wanted = new Set(data.mentions.map((n) => n.toLowerCase()));
    pushToRoom(
      room.id,
      (prefs, sub) => {
        if (sub.sessionId === data.session) return false;
        if (prefs.chatAll) return false; // already covered by the broadcast above
        if (!sub.voterName) return false;
        if (!wanted.has(sub.voterName.toLowerCase())) return false;
        return !!prefs.chatReplies; // mentions piggyback on the replies opt-in
      },
      (lang) => ({
        title: t(lang, "push_chat_mention_title", data.name),
        body: (data.body ? truncateForPush(data.body) : undefined) ?? t(lang, "push_chat_mention_body"),
        url: `/r/${code}/chat`,
        tag: `chat-mention:${code}`,
      }),
    ).catch(() => {});
  }

  // Replies — fan separately to the original author only, if their prefs
  // allow it. `replyTargetSession` was captured by the same single
  // query that did the in-room validation above; no second SELECT.
  if (data.replyTo && replyTargetSession && replyTargetSession !== data.session) {
    pushToRoom(
      room.id,
      // Skip anyone who'd already get the chatAll broadcast above —
      // otherwise reply+text = two notifications.
      (prefs, sub) =>
        !!prefs.chatReplies && !prefs.chatAll && sub.sessionId === replyTargetSession,
      (lang) => ({
        title: t(lang, "push_chat_reply_title", data.name),
        body: (data.body ? truncateForPush(data.body) : undefined) ?? t(lang, "push_chat_reply_body"),
        url: `/r/${code}/chat`,
        tag: `chat-reply:${data.replyTo}`,
      }),
    ).catch(() => {});
  }

  return NextResponse.json({ ok: true, id: row.id });
}

export const dynamic = "force-dynamic";
