import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { pushSubscriptions, type PushPrefs } from "@/lib/db/schema";
import { findRoomByCode } from "@/lib/rooms";
import { getVapidPublicKey } from "@/lib/push";
import { guardSession } from "@/lib/server-session";

// Push subscribe / prefs / unsubscribe for a single room. Voters opt
// into specific event categories per room — they may want chat on for
// their close friends' room but only "results tallied" on a public one.
//
// GET    — returns { vapidKey, subscribed, prefs } for the (room, session)
// POST   — { session, subscription, prefs } → upsert
// PATCH  — { session, prefs } → update prefs without re-subscribing
// DELETE — { session, endpoint } → drop one row

type RouteCtx = { params: Promise<{ code: string }> };

const PrefsSchema = z.object({
  chatAll: z.boolean().optional(),
  chatReplies: z.boolean().optional(),
  nowPlaying: z.boolean().optional(),
  votingState: z.boolean().optional(),
  resultsTallied: z.boolean().optional(),
});

const SubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

const PostSchema = z.object({
  session: z.string().min(8).max(64),
  name: z.string().trim().max(40).optional(),
  subscription: SubscriptionSchema,
  prefs: PrefsSchema.optional().default({}),
});

const PatchSchema = z.object({
  session: z.string().min(8).max(64),
  prefs: PrefsSchema,
});

export async function GET(req: Request, { params }: RouteCtx) {
  const { code } = await params;
  const room = await findRoomByCode(code);
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  const url = new URL(req.url);
  const session = url.searchParams.get("session");
  let prefs: PushPrefs = {};
  let subscribed = false;
  if (session) {
    const rows = await db
      .select({ prefs: pushSubscriptions.prefs })
      .from(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.roomId, room.id),
          eq(pushSubscriptions.sessionId, session),
        ),
      )
      .limit(1);
    if (rows[0]) {
      prefs = rows[0].prefs as PushPrefs;
      subscribed = true;
    }
  }

  return NextResponse.json({
    vapidKey: getVapidPublicKey(),
    subscribed,
    prefs,
  });
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
  const { session, name, subscription, prefs } = parsed.data;

  const guard = await guardSession(session);
  if (guard) return guard;

  await db
    .insert(pushSubscriptions)
    .values({
      roomId: room.id,
      sessionId: session,
      voterName: name ?? null,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      prefs,
    })
    .onConflictDoUpdate({
      target: [pushSubscriptions.roomId, pushSubscriptions.endpoint],
      set: {
        sessionId: session,
        voterName: name ?? null,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        prefs,
        updatedAt: sql`now()`,
      },
    });

  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request, { params }: RouteCtx) {
  const { code } = await params;
  const room = await findRoomByCode(code);
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  const parsed = PatchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { session, prefs } = parsed.data;

  const guard = await guardSession(session);
  if (guard) return guard;

  await db
    .update(pushSubscriptions)
    .set({ prefs, updatedAt: sql`now()` })
    .where(
      and(
        eq(pushSubscriptions.roomId, room.id),
        eq(pushSubscriptions.sessionId, session),
      ),
    );
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: RouteCtx) {
  const { code } = await params;
  const room = await findRoomByCode(code);
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  const url = new URL(req.url);
  const session = url.searchParams.get("session");
  const endpoint = url.searchParams.get("endpoint");
  if (!session) {
    return NextResponse.json({ error: "Missing session" }, { status: 400 });
  }
  const guard = await guardSession(session);
  if (guard) return guard;

  if (endpoint) {
    await db
      .delete(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.roomId, room.id),
          eq(pushSubscriptions.sessionId, session),
          eq(pushSubscriptions.endpoint, endpoint),
        ),
      );
  } else {
    await db
      .delete(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.roomId, room.id),
          eq(pushSubscriptions.sessionId, session),
        ),
      );
  }
  return NextResponse.json({ ok: true });
}
