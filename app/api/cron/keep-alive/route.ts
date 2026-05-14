import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

// Vercel-cron daily ping. Supabase pauses free-tier projects after 7
// days of zero query traffic; this route exists purely to make sure
// the project never goes idle long enough for the auto-pause to kick
// in. `vercel.json` schedules a daily GET; the handler runs a cheap
// `SELECT 1`, returns 200, and the cron run counts as activity on
// Supabase's side.
//
// Auth: Vercel injects an `Authorization: Bearer ${CRON_SECRET}`
// header on cron-triggered calls (CRON_SECRET is auto-provisioned in
// the project env). Anything missing the header gets 401 so a random
// internet caller can't burn DB roundtrips on us.

export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const got = req.headers.get("authorization");
    if (got !== `Bearer ${expected}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    await db.execute(sql`SELECT 1`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[cron/keep-alive] ping failed", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
