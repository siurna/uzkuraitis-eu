import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { siteContent } from "@/lib/db/schema";

// Public read of the welcome / housekeeping markdown. Anonymous —
// every voter needs it. Edits go through /api/admin/welcome.
export async function GET() {
  const rows = await db.select().from(siteContent);
  return NextResponse.json({
    welcome_md_en: rows.find((r) => r.key === "welcome_md_en")?.value ?? "",
    welcome_md_lt: rows.find((r) => r.key === "welcome_md_lt")?.value ?? "",
  });
}

export const dynamic = "force-dynamic";
