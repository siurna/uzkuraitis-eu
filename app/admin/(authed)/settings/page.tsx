import { db } from "@/lib/db";
import { desc } from "drizzle-orm";
import { adminCredentials, rooms, siteContent } from "@/lib/db/schema";
import { AdminPasskeysPanel } from "@/components/admin-passkeys-panel";
import { AdminSeed } from "@/components/admin-seed";
import { AdminWelcome } from "@/components/admin-welcome";
import { AdminPageTitle } from "@/components/admin-page-title";

export default async function AdminSettingsPage() {
  const [creds, roomList, welcomeRows] = await Promise.all([
    db
      .select({
        id: adminCredentials.id,
        label: adminCredentials.label,
        createdAt: adminCredentials.createdAt,
        lastUsedAt: adminCredentials.lastUsedAt,
      })
      .from(adminCredentials),
    db
      .select({ code: rooms.code, name: rooms.name })
      .from(rooms)
      .orderBy(desc(rooms.lastActiveAt)),
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
          because it's the only one the host actually edits per show. */}
      <AdminWelcome initial={welcomeInitial} />

      <AdminSeed rooms={roomList} />

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
