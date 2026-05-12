import { Standings } from "@/components/standings";
import { HoneycombPresence } from "@/components/honeycomb-presence";
import { SharePicks } from "@/components/share-picks";
import { NotificationsCta } from "@/components/notification-toggles";
import { HomeBanners } from "@/components/home-banners";
import { MyResults } from "@/components/my-results";

// Home tab. Layout owns the room context, presence bar, tab bar,
// particle layer and reactions overlay. This page is a stack of
// context-aware shortcut banners (who's on stage / vote / results /
// bingo / chat), the live-users honeycomb, the notifications CTA and
// the standings/leaderboard at the bottom (id="standings" so the
// results banner can scroll to it).
export default function RoomHomePage() {
  return (
    <div className="flex flex-col gap-5 pt-3 pb-2">
      <HoneycombPresence />
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
