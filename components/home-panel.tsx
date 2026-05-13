"use client";

import { Standings } from "@/components/standings";
import { SharePicks } from "@/components/share-picks";
import { NotificationsCta } from "@/components/notification-toggles";
import { HomeBanners } from "@/components/home-banners";
import { WhosHere } from "@/components/whos-here";
import { MyResults } from "@/components/my-results";
import { Highlights } from "@/components/highlights";

// Home tab content. Order is meaningful:
//   1. HomeBanners       — Now-playing OR Vote hero (the big top slot),
//                          plus the small "your vote is in" once cast.
//   2. MyResults         — sits right under the hero stack when the
//                          host has tallied; self-hides otherwise.
//   3. HomeBanners cont. — bingo / fan-vs-room / bonus, all rendered
//                          inside HomeBanners' AnimatePresence.
//   4. WhosHere          — the honeycomb of avatars.
//   5. Highlights        — the night's chat highlights.
//   6. NotificationsCta + SharePicks.
//   7. Fan TOP 5 (id="standings"). Self-hides when voting + tally
//      are both off.
export function HomePanel() {
  return (
    <div className="flex flex-col gap-3 pt-3 pb-2">
      <HomeBanners />
      <MyResults />
      <WhosHere />
      <Highlights />
      <div className="container mx-auto max-w-3xl px-4 flex flex-col gap-3">
        <NotificationsCta />
        <SharePicks />
      </div>
      <div id="standings" className="scroll-mt-16">
        <Standings />
      </div>
    </div>
  );
}
