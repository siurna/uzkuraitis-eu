import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { voters } from "@/lib/db/schema";
import { findRoomByCode } from "@/lib/rooms";
import { isAdminAuthed } from "@/lib/admin/session";
import { isRecoveryAvailable, signRecoveryToken } from "@/lib/recovery-token";

// Mint a private recovery link for a specific voter row. The admin
// DMs the URL to a participant who lost their PWA / cleared storage;
// opening the link restores their sessionId + name + avatar via the
// signed session cookie + a small bootstrap page.
//
// Token TTL is the helper's default (24h). Re-mint another link if
// the participant deletes again outside the window.

type RouteCtx = { params: Promise<{ code: string; sessionId: string }> };

export async function POST(_req: Request, { params }: RouteCtx) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  if (!isRecoveryAvailable()) {
    return NextResponse.json(
      { error: "UZK_SESSION_SECRET not configured" },
      { status: 500 },
    );
  }

  const { code, sessionId } = await params;
  const room = await findRoomByCode(code);
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const [voter] = await db
    .select({ id: voters.id, sessionId: voters.sessionId })
    .from(voters)
    .where(and(eq(voters.roomId, room.id), eq(voters.sessionId, sessionId)))
    .limit(1);
  if (!voter) {
    return NextResponse.json({ error: "Voter not found" }, { status: 404 });
  }

  const token = signRecoveryToken({
    sid: voter.sessionId,
    vid: voter.id,
    room: room.code,
  });

  // Caller picks the host; we return the path-only form so a deploy
  // behind any domain works. Admin UI prepends `window.location.origin`.
  return NextResponse.json({ path: `/recover/${token}`, token });
}
