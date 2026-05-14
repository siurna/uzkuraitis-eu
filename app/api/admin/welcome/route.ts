import { NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { siteContent } from "@/lib/db/schema";
import { isAdminAuthed } from "@/lib/admin/session";

// Editable "welcome / housekeeping" markdown shown as the closing
// widget on the room home, in both languages. Two reserved keys:
// `welcome_md_en` and `welcome_md_lt`. Admin session-gated.
// GET returns whatever exists; missing keys read as empty strings.

const KEYS = ["welcome_md_en", "welcome_md_lt"] as const;
type Key = (typeof KEYS)[number];

export async function GET() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }
  const rows = await db.select().from(siteContent);
  const map: Record<Key, string> = { welcome_md_en: "", welcome_md_lt: "" };
  for (const r of rows) {
    if ((KEYS as readonly string[]).includes(r.key)) {
      map[r.key as Key] = r.value;
    }
  }
  return NextResponse.json(map);
}

const PutSchema = z.object({
  welcome_md_en: z.string().max(8000).optional(),
  welcome_md_lt: z.string().max(8000).optional(),
});

export async function PUT(req: Request) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }
  const parsed = PutSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  for (const k of KEYS) {
    const value = parsed.data[k];
    if (value === undefined) continue;
    const trimmed = value.trim();
    if (!trimmed) {
      await db.delete(siteContent).where(sql`${siteContent.key} = ${k}`);
    } else {
      await db
        .insert(siteContent)
        .values({ key: k, value: trimmed })
        .onConflictDoUpdate({
          target: siteContent.key,
          set: { value: trimmed, updatedAt: sql`now()` },
        });
    }
  }
  return NextResponse.json({ ok: true });
}
