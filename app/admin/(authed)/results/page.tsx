import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { rooms, votes, voters, officialResults, officialFacts } from "@/lib/db/schema";
import { getCountry } from "@/lib/countries";
import { Flag } from "@/components/flag";
import { AdminOfficialResults } from "@/components/admin-official-results";
import { AdminOfficialFacts } from "@/components/admin-official-facts";

async function loadPerRoomTotals() {
  const list = await db
    .select({ id: rooms.id, code: rooms.code, name: rooms.name })
    .from(rooms)
    .orderBy(desc(rooms.lastActiveAt));

  return Promise.all(
    list.map(async (r) => {
      const rowsForRoom = await db
        .select({
          countryCode: votes.countryCode,
          total: sql<number>`COALESCE(SUM(${votes.points}), 0)::int`,
        })
        .from(votes)
        .innerJoin(voters, eq(voters.id, votes.voterId))
        .where(eq(voters.roomId, r.id))
        .groupBy(votes.countryCode);
      rowsForRoom.sort((a, b) => b.total - a.total);
      return { ...r, rows: rowsForRoom };
    }),
  );
}

export default async function AdminResultsPage() {
  const [perRoom, official, facts] = await Promise.all([
    loadPerRoomTotals(),
    db.select().from(officialResults),
    db.select().from(officialFacts),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-display text-3xl gradient-text">Results</h1>

      <AdminOfficialResults
        initial={official.map((o) => ({
          placement: o.placement,
          countryCode: o.countryCode,
        }))}
      />

      <AdminOfficialFacts
        initial={Object.fromEntries(facts.map((f) => [f.key, f.value]))}
      />

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-2xl">Per-room voting</h2>
        {perRoom.length === 0 ? (
          <p className="text-white/50">No rooms yet.</p>
        ) : (
          perRoom.map((r) => (
            <div key={r.id} className="glass-card rounded-xl p-5">
              <header className="flex items-baseline justify-between mb-3">
                <h3 className="font-display text-lg">{r.name}</h3>
                <code className="text-xs text-white/50 tracking-[0.2em]">
                  {r.code}
                </code>
              </header>
              {r.rows.length === 0 ? (
                <p className="text-white/40 text-sm italic">No votes yet.</p>
              ) : (
                <ol className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-sm">
                  {r.rows.slice(0, 12).map((row, i) => {
                    const c = getCountry(row.countryCode);
                    return (
                      <li
                        key={row.countryCode}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-white/[0.03]"
                      >
                        <span className="w-6 text-white/40 tabular-nums">
                          {i + 1}
                        </span>
                        <Flag code={row.countryCode} size="sm" />
                        <span className="flex-1 truncate">
                          {c?.name ?? row.countryCode}
                        </span>
                        <span className="font-display text-flamingo tabular-nums">
                          {row.total}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          ))
        )}
      </section>
    </div>
  );
}

export const dynamic = "force-dynamic";
