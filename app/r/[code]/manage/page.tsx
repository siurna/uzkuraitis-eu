import { redirect } from "next/navigation";

type RouteParams = Promise<{ code: string }>;
type RouteSearch = Promise<{ key?: string | string[] }>;

// Moved. /r/[code]/manage used to inherit the room shell (NameGate +
// PresenceBar + tab bar + the lot), which buried the host controls
// inside the voter UI. The page now lives at /host/[code] with its
// own minimal admin chrome. This stub just forwards the ?key= along
// so any bookmarked old URLs keep working.
export default async function RoomManageRedirectPage({
  params,
  searchParams,
}: {
  params: RouteParams;
  searchParams: RouteSearch;
}) {
  const { code } = await params;
  const sp = await searchParams;
  const key = Array.isArray(sp.key) ? sp.key[0] : sp.key;
  redirect(`/host/${code}${key ? `?key=${encodeURIComponent(key)}` : ""}`);
}

export const dynamic = "force-dynamic";
