import { NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { voters, votes } from "@/lib/db/schema";
import { isAdminAuthed } from "@/lib/admin/session";
import { findRoomByCode } from "@/lib/rooms";
import { countries } from "@/lib/countries";
import { postSystemMessage, postResultsMessage } from "@/lib/chat-system";

// One-tap announcements the host fires from /admin/live → a chat message
// in the target room. Admin session-gated.
const Body = z.object({
  room: z.string().length(6),
  kind: z.enum(["notifications", "vote", "bet", "top3", "final"]),
});

export async function POST(req: Request) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { room: code, kind } = parsed.data;
  const room = await findRoomByCode(code);
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  if (kind === "notifications") {
    await postSystemMessage(room.code, room.id, { key: "sys_cta_notifications" });
  } else if (kind === "vote") {
    await postSystemMessage(room.code, room.id, { key: "sys_cta_vote" });
  } else if (kind === "bet") {
    await postSystemMessage(room.code, room.id, { key: "sys_cta_bet" });
  } else if (kind === "final") {
    // The scored leaderboard podium (falls back to a plain "results are
    // in" line if nothing's scoreable yet).
    await postResultsMessage(room.code, { id: room.id, homeCountryCode: room.homeCountryCode, tallyEnabled: true });
  } else {
    // top3 — the live fan aggregate.
    const rows = await db.execute<{ country_code: string; total_points: number }>(sql`
      SELECT v.country_code AS country_code, COALESCE(SUM(v.points), 0)::int AS total_points
      FROM ${votes} v INNER JOIN ${voters} vt ON vt.id = v.voter_id
      WHERE vt.room_id = ${room.id}
      GROUP BY v.country_code ORDER BY total_points DESC LIMIT 3`);
    const list = rows.rows.map((r) => {
      const c = countries.find((x) => x.code === r.country_code);
      return c ? `${c.flag} ${c.name}` : r.country_code.toUpperCase();
    });
    if (list.length === 0) await postSystemMessage(room.code, room.id, { key: "sys_cta_top3_empty" });
    else await postSystemMessage(room.code, room.id, { key: "sys_cta_top3", arg: list.join(" · ") });
  }
  return NextResponse.json({ ok: true });
}
