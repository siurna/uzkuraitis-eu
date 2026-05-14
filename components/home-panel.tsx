"use client";

import { Standings } from "@/components/standings";
import { SharePicks } from "@/components/share-picks";
import { NotificationsCta } from "@/components/notification-toggles";
import { HomeBanners } from "@/components/home-banners";
import { WhosHere } from "@/components/whos-here";
import { Highlights } from "@/components/highlights";

// Home tab content. Reordered so the punchier "where am I right now"
// signal (Vakarėlio TOP 5) sits high in the scroll, with the quieter
// social stack underneath. Order is meaningful:
//
//   1. HomeBanners       — Now-playing / Vote hero (top slot), then
//                          MyResults (self-hides), then the Bingo /
//                          You-vs-room / Bonus banners.
//   2. Standings         — Vakarėlio TOP 5 widget (dark surface).
//                          Self-hides when voting + tally are both off.
//   3. Highlights        — the night's chat highlights.
//   4. NotificationsCta  — self-hides once push is granted.
//   5. WhosHere          — the honeycomb of avatars (here-now).
//   6. SharePicks        — your TOP 10 share card.
//
// Every child renders its own max-w-3xl container so when one returns
// null (notifications granted, no voter, voting closed) the outer
// gap collapses cleanly — no phantom wrapper divs adding mystery
// blank rows between the visible widgets.
export function HomePanel() {
  return (
    <div className="flex flex-col gap-4 pt-3 pb-2">
      <HomeBanners />
      <div id="standings" className="scroll-mt-16">
        <Standings />
      </div>
      <Highlights />
      <NotificationsCta />
      <WhosHere />
      <SharePicks />
    </div>
  );
}
