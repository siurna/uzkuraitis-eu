import { Standings } from "@/components/standings";
import { HoneycombPresence } from "@/components/honeycomb-presence";
import { SharePicks } from "@/components/share-picks";

// Home tab content. Layout owns the room context, presence bar, tab
// bar, particle layer, and reactions overlay. This page renders the
// standings + honeycomb of live users + the share-my-ballot pill
// (post-vote only). All Home-only surfaces live here.
export default function RoomHomePage() {
  return (
    <>
      <Standings />
      <div className="container mx-auto max-w-3xl px-4 pb-2">
        <SharePicks />
      </div>
      <HoneycombPresence />
    </>
  );
}

export const dynamic = "force-dynamic";
