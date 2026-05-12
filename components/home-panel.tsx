"use client";

import { Standings } from "@/components/standings";
import { SharePicks } from "@/components/share-picks";
import { NotificationsCta } from "@/components/notification-toggles";
import { HomeBanners } from "@/components/home-banners";
import { MyResults } from "@/components/my-results";

// Home tab content. A stack of context-aware shortcut cards (who's on
// stage / vote / results / bingo / chat), the notifications CTA, your
// results card, and the standings/leaderboard at the bottom
// (id="standings" so the results card can scroll to it).
export function HomePanel() {
  return (
    <div className="flex flex-col gap-5 pt-3 pb-2">
      <HomeBanners />
      <MyResults />
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
