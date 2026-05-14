import { db } from "@/lib/db";
import { siteContent } from "@/lib/db/schema";
import { AdminPageTitle } from "@/components/admin-page-title";
import { AdminWelcome } from "@/components/admin-welcome";

// "Hello folks!" — editable housekeeping markdown rendered as the
// closing widget on every room home. Two rows in site_content (one
// per language).
export default async function AdminWelcomePage() {
  const rows = await db.select().from(siteContent);
  const initial = {
    welcome_md_en:
      rows.find((r) => r.key === "welcome_md_en")?.value ?? "",
    welcome_md_lt:
      rows.find((r) => r.key === "welcome_md_lt")?.value ?? "",
  };

  return (
    <div className="flex flex-col gap-6">
      <AdminPageTitle>Welcome</AdminPageTitle>
      <AdminWelcome initial={initial} />
    </div>
  );
}

export const dynamic = "force-dynamic";
