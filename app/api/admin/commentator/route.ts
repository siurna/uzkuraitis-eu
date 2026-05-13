import { NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { commentator } from "@/lib/db/schema";
import { isAdminAuthed } from "@/lib/admin/session";

// Live-commentator config: one editable line per country, plus the bot's
// name + photo under the reserved keys '__name__' / '__photo__'. Admin
// session-gated. Empty values are deleted; non-empty are upserted.

export async function GET() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }
  const rows = await db.select().from(commentator);
  return NextResponse.json({ lines: Object.fromEntries(rows.map((r) => [r.countryCode, r.text])) });
}

const PutSchema = z.object({ lines: z.record(z.string(), z.string().nullable()) });

export async function PUT(req: Request) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }
  const parsed = PutSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  for (const [key, value] of Object.entries(parsed.data.lines)) {
    const v = (value ?? "").trim();
    if (!v) {
      await db.delete(commentator).where(sql`${commentator.countryCode} = ${key}`);
    } else {
      await db
        .insert(commentator)
        .values({ countryCode: key, text: v })
        .onConflictDoUpdate({ target: commentator.countryCode, set: { text: v, updatedAt: sql`now()` } });
    }
  }
  return NextResponse.json({ ok: true });
}
