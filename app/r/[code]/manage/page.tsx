import { notFound } from "next/navigation";
import { findRoomByCodeWithToken } from "@/lib/rooms";
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { roomResults, roomFacts } from "@/lib/db/schema";
import { RoomManage } from "@/components/room-manage";

type RouteParams = Promise<{ code: string }>;
type RouteSearch = Promise<{ key?: string | string[] }>;

// Per-room admin page. Anyone with the right ?key= for this room may
// manage it. No global passkey involved.
export default async function RoomManagePage({
  params,
  searchParams,
}: {
  params: RouteParams;
  searchParams: RouteSearch;
}) {
  const { code } = await params;
  const sp = await searchParams;
  const key = Array.isArray(sp.key) ? sp.key[0] : sp.key;

  if (!key) {
    return <Unauthorized code={code} />;
  }
  const room = await findRoomByCodeWithToken(code, key);
  if (!room) {
    // Distinguishing "wrong code" from "wrong key" gives away nothing
    // useful; we just say "not authorised".
    return <Unauthorized code={code} />;
  }

  const [results, facts] = await Promise.all([
    db.select().from(roomResults).where(eq(roomResults.roomId, room.id)),
    db.select().from(roomFacts).where(eq(roomFacts.roomId, room.id)),
  ]);

  return (
    <RoomManage
      adminToken={room.adminToken}
      room={{
        code: room.code,
        name: room.name,
        votingEnabled: room.votingEnabled,
        homeCountryCode: room.homeCountryCode,
      }}
      results={results.map((r) => ({
        countryCode: r.countryCode,
        placement: r.placement,
      }))}
      facts={Object.fromEntries(facts.map((f) => [f.key, f.value]))}
    />
  );
}

function Unauthorized({ code }: { code: string }) {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 text-center">
      <div className="glass-card rounded-2xl p-8 max-w-md flex flex-col gap-3">
        <p className="font-display text-2xl gradient-text">Not authorised</p>
        <p className="text-sm text-white/60">
          This URL needs an admin key for room <code className="font-mono">{code}</code>.
          Use the link the room creator was given.
        </p>
      </div>
    </main>
  );
}

export const dynamic = "force-dynamic";
