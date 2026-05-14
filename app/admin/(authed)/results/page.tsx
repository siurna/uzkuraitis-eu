import { Trophy } from "lucide-react";
import { db } from "@/lib/db";
import { officialResults, officialFacts } from "@/lib/db/schema";
import { AdminResultsTable } from "@/components/admin-results-table";
import { AdminPageTitle } from "@/components/admin-page-title";

// Used to be two cards (top-10 editor + side-bet ground truth) with
// their own icon-tile headers and Save buttons. They get filled out
// at the same beat in real life, so the page now collapses them into
// a single table with one Save.
export default async function AdminResultsPage() {
  const [official, facts] = await Promise.all([
    db.select().from(officialResults),
    db.select().from(officialFacts),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <AdminPageTitle icon={Trophy}>Results</AdminPageTitle>

      <AdminResultsTable
        initialResults={official.map((o) => ({
          placement: o.placement,
          countryCode: o.countryCode,
        }))}
        initialFacts={Object.fromEntries(facts.map((f) => [f.key, f.value]))}
      />
    </div>
  );
}

export const dynamic = "force-dynamic";
