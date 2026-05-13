import { notFound } from "next/navigation";
import { eq, sql, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { voters, votes, reactions, chatMessages } from "@/lib/db/schema";
import { findRoomByCode } from "@/lib/rooms";
import { getCountry } from "@/lib/countries";
import { AdminRoomToggle } from "@/components/admin-room-toggle";
import { AdminRoomDangerZone } from "@/components/admin-room-danger-zone";
import { AdminRoomRename } from "@/components/admin-room-rename";
import { AdminRoomCode } from "@/components/admin-room-code";
import { AdminRoomManageLink } from "@/components/admin-room-manage-link";
import { AdminRoomTabs } from "@/components/admin-room-tabs";
import { Flag } from "@/components/flag";

type RouteParams = Promise<{ code: string }>;

const POINTS = [12, 10, 8, 7, 6, 5, 4, 3, 2, 1] as const;

function timeAgo(d: Date): string {
  const ms = Date.now() - d.getTime();
  const m = Math.round(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  return `${days}d ago`;
}

export default async function AdminRoomDetailPage({
  params,
}: {
  params: RouteParams;
}) {
  const { code } = await params;
  const room = await findRoomByCode(code);
  if (!room) notFound();

  // Voters with their full ballots, in most-recently-active order.
  const voterRows = await db
    .select({
      id: voters.id,
      name: voters.name,
      sessionId: voters.sessionId,
      createdAt: voters.createdAt,
      updatedAt: voters.updatedAt,
      points: votes.points,
      countryCode: votes.countryCode,
    })
    .from(voters)
    .leftJoin(votes, eq(votes.voterId, voters.id))
    .where(eq(voters.roomId, room.id))
    .orderBy(desc(voters.updatedAt));

  // Chat-message count per session id, scoped to this room. Joins back to
  // the voter list by session id below.
  const msgRows = await db
    .select({
      sessionId: chatMessages.sessionId,
      n: sql<number>`COUNT(*)::int`,
    })
    .from(chatMessages)
    .where(eq(chatMessages.roomId, room.id))
    .groupBy(chatMessages.sessionId);
  const msgBySession = new Map(msgRows.map((r) => [r.sessionId, r.n]));

  type VoterAgg = {
    id: string;
    name: string;
    updatedAt: Date;
    messages: number;
    ballot: Map<number, string>;
  };
  const voterMap = new Map<string, VoterAgg>();
  for (const r of voterRows) {
    if (!voterMap.has(r.id)) {
      voterMap.set(r.id, {
        id: r.id,
        name: r.name,
        updatedAt: r.updatedAt,
        messages: msgBySession.get(r.sessionId) ?? 0,
        ballot: new Map(),
      });
    }
    if (r.points != null && r.countryCode != null) {
      voterMap.get(r.id)!.ballot.set(r.points, r.countryCode);
    }
  }
  const voterList = Array.from(voterMap.values());

  // Reaction tallies per country, top first.
  const reactionRows = await db
    .select({
      countryCode: reactions.countryCode,
      emoji: reactions.emoji,
      count: reactions.count,
    })
    .from(reactions)
    .where(eq(reactions.roomId, room.id))
    .orderBy(desc(reactions.count));

  const reactionByCountry = new Map<
    string,
    { total: number; emojis: Array<{ emoji: string; count: number }> }
  >();
  for (const r of reactionRows) {
    const entry = reactionByCountry.get(r.countryCode) ?? {
      total: 0,
      emojis: [],
    };
    entry.total += r.count;
    entry.emojis.push({ emoji: r.emoji, count: r.count });
    reactionByCountry.set(r.countryCode, entry);
  }

  // Score totals for this room.
  const scoreRows = await db
    .select({
      countryCode: votes.countryCode,
      total: sql<number>`COALESCE(SUM(${votes.points}), 0)::int`,
    })
    .from(votes)
    .innerJoin(voters, eq(voters.id, votes.voterId))
    .where(eq(voters.roomId, room.id))
    .groupBy(votes.countryCode);
  scoreRows.sort((a, b) => b.total - a.total);
  const topTen = scoreRows.slice(0, 10);
  const rest = scoreRows.slice(10);

  const standingRow = (
    row: { countryCode: string; total: number },
    i: number,
    highlight: boolean,
  ) => {
    const c = getCountry(row.countryCode);
    const r = reactionByCountry.get(row.countryCode);
    return (
      <li
        key={row.countryCode}
        className={`flex items-center gap-2 px-3 py-2 rounded-md ${
          highlight ? "bg-flamingo/10 ring-1 ring-flamingo/20" : "bg-white/[0.03]"
        }`}
      >
        <span className={`w-6 tabular-nums ${highlight ? "text-flamingo font-display" : "text-white/40"}`}>
          {i + 1}
        </span>
        <Flag code={row.countryCode} size="sm" />
        <span className="flex-1 truncate text-sm">{c?.name ?? row.countryCode}</span>
        {r && (
          <span
            className="text-xs text-white/50"
            title={r.emojis.map((e) => `${e.emoji} ${e.count}`).join("  ")}
          >
            {r.emojis.slice(0, 3).map((e) => e.emoji).join("")}
            <span className="ml-1 tabular-nums">{r.total}</span>
          </span>
        )}
        <span className="font-display text-flamingo tabular-nums w-8 text-right">{row.total}</span>
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-3xl gradient-text truncate heading-rise">
              {room.name}
            </h1>
            <code className="text-xs text-white/50 tracking-[0.3em] font-display">
              {room.code}
            </code>
          </div>
          <p className="text-xs text-white/40 mt-1">
            Created {new Date(room.createdAt).toLocaleDateString()} ·{" "}
            {voterList.length} voter{voterList.length === 1 ? "" : "s"}
          </p>
        </div>
        <AdminRoomToggle code={room.code} initialEnabled={room.votingEnabled} />
      </header>

      <AdminRoomTabs
        overview={
          <>
            <section className="glass-card rounded-xl p-5">
              <h2 className="font-display text-xl mb-4">
                Standings ({scoreRows.length || 0})
              </h2>
              {scoreRows.length === 0 ? (
                <p className="text-white/40 text-sm italic">No votes cast yet.</p>
              ) : (
                <div className="grid gap-x-6 gap-y-1 md:grid-cols-2">
                  {/* left column — the top 10 (the "ballot" the room collectively cast) */}
                  <ol className="flex flex-col gap-1">{topTen.map((row, i) => standingRow(row, i, true))}</ol>
                  {/* right column — everyone else */}
                  {rest.length > 0 ? (
                    <ol className="flex flex-col gap-1">{rest.map((row, i) => standingRow(row, i + 10, false))}</ol>
                  ) : (
                    <p className="hidden md:block text-white/30 text-sm italic self-start mt-2">
                      Only the top 10 have points so far.
                    </p>
                  )}
                </div>
              )}
            </section>

            {reactionRows.length > 0 && (
              <section className="glass-card rounded-xl p-5">
                <h2 className="font-display text-xl mb-4">
                  Reactions ({reactionRows.length})
                </h2>
                <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
                  {Array.from(reactionByCountry.entries()).map(([cc, agg]) => {
                    const c = getCountry(cc);
                    return (
                      <li
                        key={cc}
                        className="flex items-center gap-2 px-3 py-2 rounded-md bg-white/[0.03]"
                      >
                        <Flag code={cc} size="sm" />
                        <span className="flex-1 truncate">{c?.name ?? cc}</span>
                        <span className="text-xs text-white/60">
                          {agg.emojis
                            .map((r) => `${r.emoji}${r.count}`)
                            .join(" ")}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
          </>
        }
        voters={
          <section className="glass-card rounded-xl p-5">
            <h2 className="font-display text-xl mb-4">
              Voters ({voterList.length})
            </h2>
            {voterList.length === 0 ? (
              <p className="text-white/40 text-sm italic">No one has voted yet.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {voterList.map((v) => (
                  <details
                    key={v.id}
                    className="rounded-lg bg-white/[0.03] border border-white/5"
                  >
                    <summary className="flex items-center gap-3 px-3 py-2 cursor-pointer list-none">
                      <span className="font-display flex-1 truncate">{v.name}</span>
                      <span className="text-xs text-white/40 tabular-nums shrink-0">
                        {v.ballot.size}/10 ·{" "}
                        {v.messages} msg{v.messages === 1 ? "" : "s"} ·{" "}
                        {timeAgo(v.updatedAt)}
                      </span>
                    </summary>
                    <div className="px-3 pb-3 grid grid-cols-2 sm:grid-cols-5 gap-1">
                      {POINTS.map((p) => {
                        const cc = v.ballot.get(p);
                        const c = cc ? getCountry(cc) : null;
                        return (
                          <div
                            key={p}
                            className="flex items-center gap-1.5 px-2 py-1.5 rounded bg-black/30 text-xs"
                          >
                            <span className="w-5 text-flamingo font-display tabular-nums">
                              {p}
                            </span>
                            {c ? (
                              <>
                                <Flag code={c.code} size="sm" />
                                <span className="truncate">{c.name}</span>
                              </>
                            ) : (
                              <span className="text-white/30 italic">—</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </details>
                ))}
              </div>
            )}
          </section>
        }
        settings={
          <div className="flex flex-col gap-6">
            <section className="glass-card rounded-xl p-5">
              <h2 className="font-display text-xl mb-3">Room name</h2>
              <AdminRoomRename code={room.code} initialName={room.name} />
            </section>
            <section className="glass-card rounded-xl p-5">
              <h2 className="font-display text-xl mb-3">Join code</h2>
              <AdminRoomCode code={room.code} />
            </section>
            <AdminRoomManageLink code={room.code} adminToken={room.adminToken} />
            <AdminRoomDangerZone code={room.code} />
          </div>
        }
      />
    </div>
  );
}

export const dynamic = "force-dynamic";
