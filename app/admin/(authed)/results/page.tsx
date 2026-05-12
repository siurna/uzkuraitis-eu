import { db } from "@/lib/db";
import { officialResults, officialFacts } from "@/lib/db/schema";
import { AdminOfficialResults } from "@/components/admin-official-results";
import { AdminOfficialFacts } from "@/components/admin-official-facts";

// Per-room voting tables used to live here too — they were a duplicate
// of what each individual room admin page already shows. Removed.
export default async function AdminResultsPage() {
  const [official, facts] = await Promise.all([
    db.select().from(officialResults),
    db.select().from(officialFacts),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-display text-3xl gradient-text heading-rise">Results</h1>

      <AdminOfficialResults
        initial={official.map((o) => ({
          placement: o.placement,
          countryCode: o.countryCode,
        }))}
      />

      <AdminOfficialFacts
        initial={Object.fromEntries(facts.map((f) => [f.key, f.value]))}
      />
    </div>
  );
}

export const dynamic = "force-dynamic";
