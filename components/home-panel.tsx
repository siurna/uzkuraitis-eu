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
    <div className="flex flex-col gap-4 pt-3 pb-8">
      <HomeBanners />
      {/* The Standings widget self-hides when there's nothing live to
          show (no voting, no tally) — render it as a direct child of
          the flex column so its `return null` collapses cleanly out
          of the gap chain. An outer `<div id="standings">` here would
          still occupy a 16px gap even when the inner returned null.
          The `#standings` anchor + scroll margin now lives on the
          widget's own root <section> inside components/standings.tsx. */}
      <Standings />
      <Highlights />
      <NotificationsCta />
      <WhosHere />
      <SharePicks />
      <WelcomeBanner />
    </div>
  );
}
