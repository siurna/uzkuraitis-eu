"use client";

import { Standings } from "@/components/standings";
import { SharePicks } from "@/components/share-picks";
import { NotificationsCta } from "@/components/notification-toggles";
import { HomeBanners } from "@/components/home-banners";
import { WhosHere } from "@/components/whos-here";
import { Highlights } from "@/components/highlights";
import { WelcomeBanner } from "@/components/welcome-banner";

// Home tab content. Welcome / housekeeping is the LAST widget in the
// scroll so it reads as a closing note, not something the eye fights
// for attention with the live show. The "where am I right now" signal
// (now-playing / Standings) sits at the top.
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
      <WelcomeBanner />
    </div>
  );
}
