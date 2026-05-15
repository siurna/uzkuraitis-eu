import Link from "next/link";
import { findRoomByCodeWithToken } from "@/lib/rooms";
import { HostControls } from "@/components/host-controls";

type RouteParams = Promise<{ code: string }>;
type RouteSearch = Promise<{ key?: string | string[] }>;

// Per-room host page. Anyone with the right ?key= for this room may
// manage it. No global passkey involved.
//
// Old path was /r/[code]/manage which sat INSIDE the room shell layout
// (NameGate, PresenceBar, RoomTabBar, etc) — that was loading the
// whole voter UI on top of the admin controls. The new /host/[code]
// uses its own minimal layout that just centres the admin chrome.
export default async function HostManagePage({
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
    <HostControls
      adminToken={room.adminToken}
      room={{
        code: room.code,
        name: room.name,
        votingEnabled: room.votingEnabled,
        tallyEnabled: room.tallyEnabled,
        triviaEnabled: room.triviaEnabled,
        commentatorEnabled: room.commentatorEnabled,
      }}
    />
  );
}

function Unauthorized({ code }: { code: string }) {
  return (
    <main className="min-h-dvh flex items-center justify-center px-4 text-center">
      <div className="glass-card rounded-2xl p-8 max-w-md flex flex-col gap-3">
        <p className="font-display text-2xl gradient-text">Not authorised</p>
        <p className="text-sm text-white/60">
          This URL needs an admin key for room{" "}
          <code className="font-mono">{code}</code>. Use the link the room
          creator was given.
        </p>
        <Link
          href={`/?room=${code}`}
          className="text-sm text-flamingo hover:underline mt-2"
        >
          Go to the room as a viewer →
        </Link>
      </div>
    </main>
  );
}

export const dynamic = "force-dynamic";
