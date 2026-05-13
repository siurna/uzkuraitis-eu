import { NextResponse } from "next/server";
import { z } from "zod";
import { findRoomByCode, normalizeRoomCode } from "@/lib/rooms";
import {
  isTurnstileConfigured,
  verifyTurnstileToken,
} from "@/lib/turnstile";

// POST /api/rooms/verify-join
//
// Body: { code, token? }
// Verifies the Turnstile token (when configured), confirms the room
// exists, and sets a per-room cookie `uzk_j_<code>=1` for 30 days. The
// /middleware.ts gate blocks direct navigation to /r/<code> without
// this cookie — anyone deep-linking is bounced back to /?code=<code>
// to clear the challenge first.

const Body = z.object({
  code: z.string().min(6).max(6),
  token: z.string().max(2048).optional(),
});

const JOIN_COOKIE_PREFIX = "uzk_j_";

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const code = normalizeRoomCode(parsed.data.code);

  if (isTurnstileConfigured()) {
    // Cloudflare wants the caller's IP — Vercel surfaces it on this
    // header. Best-effort: if it's missing, verify still works.
    const remoteIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined;
    const ok = await verifyTurnstileToken(parsed.data.token, remoteIp);
    if (!ok) {
      return NextResponse.json(
        { error: "Couldn't verify you — try again." },
        { status: 403 },
      );
    }
  }

  const room = await findRoomByCode(code);
  if (!room) {
    return NextResponse.json(
      { error: "No room with that code." },
      { status: 404 },
    );
  }

  const res = NextResponse.json({ ok: true, code: room.code });
  res.cookies.set(`${JOIN_COOKIE_PREFIX}${room.code}`, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return res;
}

export const dynamic = "force-dynamic";
