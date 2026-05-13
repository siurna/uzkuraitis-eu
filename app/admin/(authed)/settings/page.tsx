import { db } from "@/lib/db";
import { adminCredentials } from "@/lib/db/schema";
import { AdminPasskeysPanel } from "@/components/admin-passkeys-panel";
import { AdminSeed } from "@/components/admin-seed";

export default async function AdminSettingsPage() {
  const creds = await db
    .select({
      id: adminCredentials.id,
      label: adminCredentials.label,
      createdAt: adminCredentials.createdAt,
      lastUsedAt: adminCredentials.lastUsedAt,
    })
    .from(adminCredentials);

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="font-display text-3xl gradient-text heading-rise">Settings</h1>
        <p className="text-sm text-white/50 mt-1">
          Passkeys and environment.
        </p>
      </header>

      <AdminPasskeysPanel
        credentials={creds.map((c) => ({
          id: c.id,
          label: c.label,
          createdAt: c.createdAt.toISOString(),
          lastUsedAt: c.lastUsedAt?.toISOString() ?? null,
        }))}
      />

      <AdminSeed />

      <section className="glass-card rounded-xl p-5">
        <h2 className="font-display text-xl mb-3">Environment</h2>
        <ul className="text-sm space-y-2 text-white/70">
          <li className="flex justify-between gap-2">
            <span>Database</span>
            <code className="text-white/40 truncate max-w-[16rem]">
              {process.env.DATABASE_URL ? "configured" : "MISSING"}
            </code>
          </li>
          <li className="flex justify-between gap-2">
            <span>Liveblocks</span>
            <code className="text-white/40">
              {(process.env.LIVEBLOCKS_SECRET_KEY ??
                process.env.LIVEBLOCKS_PRIVATE_KEY)
                ? "configured"
                : "MISSING"}
            </code>
          </li>
          <li className="flex justify-between gap-2">
            <span>Auth model</span>
            <code className="text-white/40">passkey (TOFU)</code>
          </li>
        </ul>
      </section>
    </div>
  );
}

export const dynamic = "force-dynamic";
