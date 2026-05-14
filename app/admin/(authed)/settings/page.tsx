import { db } from "@/lib/db";
import { adminCredentials, siteContent } from "@/lib/db/schema";
import { AdminPasskeysPanel } from "@/components/admin-passkeys-panel";
import { AdminWelcome } from "@/components/admin-welcome";
import { AdminPageTitle } from "@/components/admin-page-title";

export default async function AdminSettingsPage() {
  const [creds, welcomeRows] = await Promise.all([
    db
      .select({
        id: adminCredentials.id,
        label: adminCredentials.label,
        createdAt: adminCredentials.createdAt,
        lastUsedAt: adminCredentials.lastUsedAt,
      })
      .from(adminCredentials),
    db.select().from(siteContent),
  ]);
  const welcomeInitial = {
    welcome_md_en: welcomeRows.find((r) => r.key === "welcome_md_en")?.value ?? "",
    welcome_md_lt: welcomeRows.find((r) => r.key === "welcome_md_lt")?.value ?? "",
  };

  return (
    <div className="flex flex-col gap-8">
      <AdminPageTitle>Settings</AdminPageTitle>

      {/* "Hello folks" markdown — closing widget on every room home +
          the body of the welcome broadcast chat card. First section
          because it's the only one the host actually edits per show.
          Seed-data lives on each per-room page now (under
          Operations); the global Settings page stays focused on
          installation-wide stuff. */}
      <AdminWelcome initial={welcomeInitial} />

      <AdminPasskeysPanel
        credentials={creds.map((c) => ({
          id: c.id,
          label: c.label,
          createdAt: c.createdAt.toISOString(),
          lastUsedAt: c.lastUsedAt?.toISOString() ?? null,
        }))}
      />
    </div>
  );
}

export const dynamic = "force-dynamic";
