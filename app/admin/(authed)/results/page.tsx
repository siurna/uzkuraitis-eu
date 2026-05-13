import { Trophy } from "lucide-react";
import { db } from "@/lib/db";
import { officialResults, officialFacts } from "@/lib/db/schema";
import { AdminOfficialResults } from "@/components/admin-official-results";
import { AdminOfficialFacts } from "@/components/admin-official-facts";
import { AdminPageTitle } from "@/components/admin-page-title";

// Per-room voting tables used to live here too — they were a duplicate
// of what each individual room admin page already shows. Removed.
export default async function AdminResultsPage() {
  const [official, facts] = await Promise.all([
    db.select().from(officialResults),
    db.select().from(officialFacts),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <AdminPageTitle icon={Trophy}>Results</AdminPageTitle>

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
