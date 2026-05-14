import { db } from "@/lib/db";
import { officialResults, officialFacts } from "@/lib/db/schema";
import { AdminResultsTable } from "@/components/admin-results-table";

// AdminResultsTable owns the AdminPageTitle now (so the live
// "filled/total" badge can sit in the title's trailing slot without
// the server-client state gap). Page is a thin loader.
export default async function AdminResultsPage() {
  const [official, facts] = await Promise.all([
    db.select().from(officialResults),
    db.select().from(officialFacts),
  ]);

  return (
    <AdminResultsTable
      initialResults={official.map((o) => ({
        placement: o.placement,
        countryCode: o.countryCode,
      }))}
      initialFacts={Object.fromEntries(facts.map((f) => [f.key, f.value]))}
    />
  );
}

export const dynamic = "force-dynamic";
