import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { siteContent } from "@/lib/db/schema";

// Public read of the welcome / housekeeping markdown. Anonymous —
// every voter needs it. Cached at the edge with a short SWR window:
// content changes ~daily (admin edits between shows), so a 60-second
// stale window is invisible and saves a DB roundtrip on every fresh
// room arrival. Admin saves don't need an explicit purge because
// the home banner subscribes to `uzk:welcome-refresh` and refetches
// on its own.
export async function GET() {
  const rows = await db.select().from(siteContent);
  const res = NextResponse.json({
    welcome_md_en: rows.find((r) => r.key === "welcome_md_en")?.value ?? "",
    welcome_md_lt: rows.find((r) => r.key === "welcome_md_lt")?.value ?? "",
  });
  res.headers.set(
    "Cache-Control",
    "public, s-maxage=60, stale-while-revalidate=600",
  );
  return res;
}
