import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { rooms, votes, voters } from "@/lib/db/schema";
import { countries } from "@/lib/countries";

async function loadResults() {
  const list = await db
    .select({ id: rooms.id, code: rooms.code, name: rooms.name })
    .from(rooms)
    .orderBy(desc(rooms.lastActiveAt));

  const perRoom = await Promise.all(
    list.map(async (r) => {
      const rows = await db
        .select({
          countryCode: votes.countryCode,
          total: sql<number>`COALESCE(SUM(${votes.points}), 0)::int`,
        })
        .from(votes)
        .innerJoin(voters, eq(voters.id, votes.voterId))
        .where(eq(voters.roomId, r.id))
        .groupBy(votes.countryCode);

      rows.sort((a, b) => b.total - a.total);
      return { ...r, rows };
    }),
  );

  return perRoom;
}

export default async function AdminResultsPage() {
  const data = await loadResults();
  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-display text-3xl gradient-text">Results</h1>
      {data.length === 0 ? (
        <p className="text-white/50">No rooms yet.</p>
      ) : (
        data.map((r) => (
          <section key={r.id} className="glass-card rounded-xl p-5">
            <header className="flex items-baseline justify-between mb-3">
              <h2 className="font-display text-xl">{r.name}</h2>
              <code className="text-xs text-white/50 tracking-[0.2em]">
                {r.code}
              </code>
            </header>
            {r.rows.length === 0 ? (
              <p className="text-white/40 text-sm italic">No votes yet.</p>
            ) : (
              <ol className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-sm">
                {r.rows.slice(0, 12).map((row, i) => {
                  const c = countries.find((c) => c.code === row.countryCode);
                  return (
                    <li
                      key={row.countryCode}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-white/[0.03]"
                    >
                      <span className="w-6 text-white/40 tabular-nums">{i + 1}</span>
                      <span className="text-base">{c?.flag ?? "🏳️"}</span>
                      <span className="flex-1 truncate">{c?.name ?? row.countryCode}</span>
                      <span className="font-display text-flamingo tabular-nums">
                        {row.total}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        ))
      )}
    </div>
  );
}

export const dynamic = "force-dynamic";
