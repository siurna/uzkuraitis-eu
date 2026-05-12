import { TabSync } from "@/components/tab-sync";

// The room is a client-side one-pager: the shell (in layout.tsx) mounts
// Home / Chat / Bingo / Vote as panels and switches between them with
// pure state — no navigation, no RSC round-trip. This page only forwards
// an optional ?tab= deep link into that state.
export default async function RoomPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  return <TabSync tab={tab} />;
}
