"use client";

import { Standings } from "@/components/standings";
import { SharePicks } from "@/components/share-picks";
import { NotificationsCta } from "@/components/notification-toggles";
import { HomeBanners } from "@/components/home-banners";
import { WhosHere } from "@/components/whos-here";
import { Highlights } from "@/components/highlights";

// Home tab content. Order is meaningful:
//   1. HomeBanners       — Now-playing OR Vote hero (top slot), then
//                          the Results card directly below it (self-
//                          hides when tally is off), then bingo /
//                          vs-room / bonus banners.
//   2. WhosHere          — the honeycomb of avatars.
//   3. Highlights        — the night's chat highlights.
//   4. NotificationsCta + SharePicks.
//   5. Fan TOP 5 (id="standings"). Self-hides when voting + tally
//      are both off.
export function HomePanel() {
  return (
    <div className="flex flex-col gap-3 pt-3 pb-2">
      <HomeBanners />
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
