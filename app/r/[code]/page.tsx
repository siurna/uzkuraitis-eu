import { Standings } from "@/components/standings";
import { HoneycombPresence } from "@/components/honeycomb-presence";

// Home tab content. Layout owns the room context, presence bar, tab
// bar, particle layer, and reactions overlay. This page just renders
// the standings + the honeycomb of live users — both of which only
// belong on Home.
export default function RoomHomePage() {
  return (
    <>
      <Standings />
      <HoneycombPresence />
    </>
  );
}

export const dynamic = "force-dynamic";
