import { findRoomByCodeWithToken } from "@/lib/rooms";
import { RoomManage } from "@/components/room-manage";

type RouteParams = Promise<{ code: string }>;
type RouteSearch = Promise<{ key?: string | string[] }>;

// Per-room admin page. Anyone with the right ?key= for this room may
// manage it. No global passkey involved.
//
// This page is intentionally minimal — the host running a watch-along
// only needs two toggles (voting / tally bets). Heavyweight admin
// (rename, code change, danger zone, per-room results override) lives
// at /admin/rooms/[code] for the global meta-admin.
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

  if (!key) return <Unauthorized code={code} />;
  const room = await findRoomByCodeWithToken(code, key);
  if (!room) return <Unauthorized code={code} />;

  return (
    <RoomManage
      adminToken={room.adminToken}
      room={{
        code: room.code,
        name: room.name,
        votingEnabled: room.votingEnabled,
        tallyEnabled: room.tallyEnabled,
      }}
    />
  );
}

function Unauthorized({ code }: { code: string }) {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 text-center">
      <div className="glass-card rounded-2xl p-8 max-w-md flex flex-col gap-3">
        <p className="font-display text-2xl gradient-text">Not authorised</p>
        <p className="text-sm text-white/60">
          This URL needs an admin key for room{" "}
          <code className="font-mono">{code}</code>. Use the link the room
          creator was given.
        </p>
      </div>
    </main>
  );
}

export const dynamic = "force-dynamic";
