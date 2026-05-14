import { db } from "@/lib/db";
import { commentator } from "@/lib/db/schema";
import { AdminCommentator } from "@/components/admin-commentator";

// Live Commentator lives on its own page now — it's a deep editorial
// surface (one line per country) and was crowding the Settings page.
// AdminCommentator owns its own AdminPageTitle so the autosave status
// pill can sit in the title's trailing slot.
export default async function AdminCommentatorPage() {
  const rows = await db.select().from(commentator);
  const initial = Object.fromEntries(rows.map((r) => [r.countryCode, r.text]));

  return <AdminCommentator initial={initial} />;
}

export const dynamic = "force-dynamic";
