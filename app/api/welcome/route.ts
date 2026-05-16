import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { siteContent } from "@/lib/db/schema";

// Public read of the welcome / housekeeping markdown. Anonymous —
// every voter needs it. Cached aggressively at the edge: content
// changes ~daily (admin edits between shows) and rooms broadcast
// `uzk:welcome-refresh` to trigger their own client refetches, so
// the edge cache can live for 5 minutes and the SWR window for an
// hour without anyone noticing.
export async function GET() {
  const rows = await db.select().from(siteContent);
  const res = NextResponse.json({
    welcome_md_en: rows.find((r) => r.key === "welcome_md_en")?.value ?? "",
    welcome_md_lt: rows.find((r) => r.key === "welcome_md_lt")?.value ?? "",
  });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
