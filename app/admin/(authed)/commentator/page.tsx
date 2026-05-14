import { db } from "@/lib/db";
import { commentator } from "@/lib/db/schema";
import { AdminPageTitle } from "@/components/admin-page-title";
import { AdminCommentator } from "@/components/admin-commentator";

// Live Commentator lives on its own page now — it's a deep editorial
// surface (one line per country) and was crowding the Settings page.
export default async function AdminCommentatorPage() {
  const rows = await db.select().from(commentator);
  const initial = Object.fromEntries(rows.map((r) => [r.countryCode, r.text]));

  return (
    <div className="flex flex-col gap-6">
      <AdminPageTitle>Commentator</AdminPageTitle>
      <AdminCommentator initial={initial} />
    </div>
  );
}

export const dynamic = "force-dynamic";
