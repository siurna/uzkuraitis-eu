import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { rooms } from "@/lib/db/schema";
import { isAdminAuthed } from "@/lib/admin/session";
import { postTriviaMessage } from "@/lib/chat-system";
import { getTriviaMerged } from "@/lib/trivia-store";

// Admin-scheduled trivia firing. The admin live panel runs its own
// setTimeout (random 30s–2:30 after a country goes live) and POSTs
// here when it fires. We fan out the trivia card to every room. No
// long-running server-side timer needed; the admin's browser is the
// scheduler.

const PostSchema = z.object({
  countryCode: z.string().length(2),
});

export async function POST(req: Request) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const parsed = PostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const { countryCode } = parsed.data;
  // No question for this country? Skip silently — the admin doesn't
  // need to know which countries do/don't have a question.
  if (!(await getTriviaMerged(countryCode))) {
    return NextResponse.json({ fired: 0 });
  }
  const allRooms = await db
    .select({
      id: rooms.id,
      code: rooms.code,
      nowPlayingCode: rooms.nowPlayingCode,
      triviaEnabled: rooms.triviaEnabled,
    })
    .from(rooms);
  // Two filters:
  //   - room must STILL have this country on stage (skips stale
  //     timers that survived an admin advance past the country)
  //   - room must have triviaEnabled (per-room opt-out)
  // Only increment `fired` when the helper actually landed (DB insert
  // + broadcast both succeeded). Previously this counted every room
  // we ATTEMPTED to post to, which made silent DB / Supabase failures
  // look like successful fires in the admin's diagnostic toast.
  const results = await Promise.all(
    allRooms
      .filter((r) => r.nowPlayingCode === countryCode && r.triviaEnabled)
      .map((r) => postTriviaMessage(r.code, r.id, countryCode)),
  );
  const fired = results.filter(Boolean).length;
  return NextResponse.json({ fired });
}
