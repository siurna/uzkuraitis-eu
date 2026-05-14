import { db } from "@/lib/db";
import { desc } from "drizzle-orm";
import { adminCredentials, rooms } from "@/lib/db/schema";
import { AdminPasskeysPanel } from "@/components/admin-passkeys-panel";
import { AdminSeed } from "@/components/admin-seed";
import { AdminPageTitle } from "@/components/admin-page-title";

export default async function AdminSettingsPage() {
  const creds = await db
    .select({
      id: adminCredentials.id,
      label: adminCredentials.label,
      createdAt: adminCredentials.createdAt,
      lastUsedAt: adminCredentials.lastUsedAt,
    })
    .from(adminCredentials);
  const roomList = await db
    .select({ code: rooms.code, name: rooms.name })
    .from(rooms)
    .orderBy(desc(rooms.lastActiveAt));

  return (
    <div className="flex flex-col gap-8">
      <AdminPageTitle>Settings</AdminPageTitle>

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
