import { notFound } from "next/navigation";
import { eq, sql, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  voters,
  votes,
  reactions,
  chatMessages,
  chatReactions,
  triviaAnswers,
} from "@/lib/db/schema";
import { findRoomByCode } from "@/lib/rooms";
import { getCountry } from "@/lib/countries";
import { AdminRoomToggle } from "@/components/admin-room-toggle";
import { AdminRoomDangerZone } from "@/components/admin-room-danger-zone";
import { AdminRoomRename } from "@/components/admin-room-rename";
import { AdminRoomCode } from "@/components/admin-room-code";
import { AdminRoomManageLink } from "@/components/admin-room-manage-link";
import { AdminRoomCommentatorToggle } from "@/components/admin-room-commentator-toggle";
import { AdminRoomTallyToggle } from "@/components/admin-room-tally-toggle";
import { AdminRoomTabs } from "@/components/admin-room-tabs";
import {
  AdminParticipantMessages,
  type AdminMessageRow,
} from "@/components/admin-participant-messages";
import { Flag } from "@/components/flag";
import { timeAgo } from "@/lib/utils";

type RouteParams = Promise<{ code: string }>;

const POINTS = [12, 10, 8, 7, 6, 5, 4, 3, 2, 1] as const;

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

  // Per-session activity rollup. Each metric is its own GROUP BY so the
  // joins stay legible; the table only ever has tens of participants in
  // a watch-along room so the extra roundtrips don't matter.
  const msgRows = await db
    .select({ sessionId: chatMessages.sessionId, n: sql<number>`COUNT(*)::int` })
    .from(chatMessages)
    .where(eq(chatMessages.roomId, room.id))
    .groupBy(chatMessages.sessionId);
  const msgBySession = new Map(msgRows.map((r) => [r.sessionId, r.n]));

  const reactGivenRows = await db
    .select({
      sessionId: chatReactions.sessionId,
      n: sql<number>`COUNT(*)::int`,
    })
    .from(chatReactions)
    .innerJoin(chatMessages, eq(chatMessages.id, chatReactions.messageId))
    .where(eq(chatMessages.roomId, room.id))
    .groupBy(chatReactions.sessionId);
  const reactGivenBySession = new Map(reactGivenRows.map((r) => [r.sessionId, r.n]));

  const reactReceivedRows = await db
    .select({
      sessionId: chatMessages.sessionId,
      n: sql<number>`COUNT(*)::int`,
    })
    .from(chatReactions)
    .innerJoin(chatMessages, eq(chatMessages.id, chatReactions.messageId))
    .where(eq(chatMessages.roomId, room.id))
    .groupBy(chatMessages.sessionId);
  const reactReceivedBySession = new Map(reactReceivedRows.map((r) => [r.sessionId, r.n]));

  const triviaRows = await db
    .select({
      sessionId: triviaAnswers.sessionId,
      total: sql<number>`COUNT(*)::int`,
      correct: sql<number>`COUNT(*) FILTER (WHERE ${triviaAnswers.correct})::int`,
    })
    .from(triviaAnswers)
    .where(eq(triviaAnswers.roomId, room.id))
    .groupBy(triviaAnswers.sessionId);
  const triviaBySession = new Map(
    triviaRows.map((r) => [r.sessionId, { total: r.total, correct: r.correct }]),
  );

  // The last few real messages each session has posted, for the admin
  // moderation strip inside each participant's drawer. Pull the most
  // recent ~10 per session at the DB level via a window function.
  const recentMessageRows = await db.execute<{
    id: string;
    session_id: string;
    kind: string;
    body: string | null;
    gif_url: string | null;
    created_at: Date;
  }>(sql`
    SELECT id, session_id, kind, body, gif_url, created_at
    FROM (
      SELECT id, session_id, kind, body, gif_url, created_at,
             ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY created_at DESC) AS rn
      FROM ${chatMessages}
      WHERE room_id = ${room.id}
        AND session_id NOT IN ('system', 'commentator')
    ) AS ranked
    WHERE rn <= 10
    ORDER BY session_id, created_at DESC
  `);
  const messagesBySession = new Map<string, AdminMessageRow[]>();
  for (const r of recentMessageRows.rows) {
    const arr = messagesBySession.get(r.session_id) ?? [];
    arr.push({
      id: r.id,
      kind: r.kind,
      body: r.body,
      gifUrl: r.gif_url,
      createdAt: new Date(r.created_at).toISOString(),
    });
    messagesBySession.set(r.session_id, arr);
  }

  type VoterAgg = {
    id: string;
    name: string;
    sessionId: string;
    updatedAt: Date;
    messages: number;
    reactionsGiven: number;
    reactionsReceived: number;
    triviaCorrect: number;
    triviaTotal: number;
    ballot: Map<number, string>;
    recent: AdminMessageRow[];
  };
  const voterMap = new Map<string, VoterAgg>();
  for (const r of voterRows) {
    if (!voterMap.has(r.id)) {
      const trivia = triviaBySession.get(r.sessionId);
      voterMap.set(r.id, {
        id: r.id,
        name: r.name,
        sessionId: r.sessionId,
        updatedAt: r.updatedAt,
        messages: msgBySession.get(r.sessionId) ?? 0,
        reactionsGiven: reactGivenBySession.get(r.sessionId) ?? 0,
        reactionsReceived: reactReceivedBySession.get(r.sessionId) ?? 0,
        triviaCorrect: trivia?.correct ?? 0,
        triviaTotal: trivia?.total ?? 0,
        ballot: new Map(),
        recent: messagesBySession.get(r.sessionId) ?? [],
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
            {voterList.length} participant{voterList.length === 1 ? "" : "s"}
          </p>
        </div>
        <AdminRoomToggle code={room.code} initialEnabled={room.votingEnabled} />
      </header>

      <AdminRoomTabs
        participantCount={voterList.length}
        overview={
          <>
            {/* No card wrapper — the standings ARE the content of the
                Overview tab. Wrapping them in glass-card was a card
                inside a card inside a tab. */}
            <section className="flex flex-col gap-4">
              <h2 className="font-display text-xl">
                Standings ({scoreRows.length || 0})
              </h2>
              {scoreRows.length === 0 ? (
                <p className="text-white/40 text-sm italic">No votes cast yet.</p>
              ) : (
                <div className="grid gap-x-6 gap-y-1 md:grid-cols-2">
                  <ol className="flex flex-col gap-1">{topTen.map((row, i) => standingRow(row, i, true))}</ol>
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
              <section className="flex flex-col gap-4">
                <h2 className="font-display text-xl">
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
                          {agg.emojis.map((r) => `${r.emoji}${r.count}`).join(" ")}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
          </>
        }
        participants={
          <section className="flex flex-col gap-4">
            <h2 className="font-display text-xl">
              Participants ({voterList.length})
            </h2>
            {voterList.length === 0 ? (
              <p className="text-white/40 text-sm italic">Nobody's joined yet.</p>
            ) : (
              // Table-style layout: a header row of column labels and one
              // <details> per participant. The summary uses the same grid
              // template as the header so cells line up cleanly. Expanded
              // rows show the full ballot + recent messages strip.
              <div className="rounded-lg bg-white/[0.02] border border-white/5 overflow-hidden">
                {/* Column labels. Hidden on small screens — the row falls
                    back to a single-line "name + 'tap for details'" view
                    so the table doesn't get squished. */}
                <div className="hidden sm:grid grid-cols-[minmax(0,1fr)_72px_60px_88px_72px_76px_28px] gap-3 px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-white/40 font-display bg-white/[0.03] border-b border-white/5">
                  <span>Name</span>
                  <span className="text-right">Ballot</span>
                  <span className="text-right">Msgs</span>
                  <span className="text-right">❤️ in/out</span>
                  <span className="text-right">Trivia</span>
                  <span className="text-right">Active</span>
                  <span />
                </div>
                <ul className="divide-y divide-white/5">
                  {voterList.map((v) => (
                    <li key={v.id}>
                      <details className="group">
                        <summary className="grid grid-cols-[minmax(0,1fr)_28px] sm:grid-cols-[minmax(0,1fr)_72px_60px_88px_72px_76px_28px] items-center gap-3 px-3 py-2.5 cursor-pointer list-none hover:bg-white/[0.02] transition">
                          <span className="font-display truncate">{v.name}</span>
                          <span className="hidden sm:block text-right text-sm text-white/85 tabular-nums">
                            {v.ballot.size}<span className="text-white/35">/10</span>
                          </span>
                          <span className="hidden sm:block text-right text-sm text-white/85 tabular-nums">
                            {v.messages}
                          </span>
                          <span className="hidden sm:block text-right text-sm text-white/85 tabular-nums">
                            {v.reactionsReceived}<span className="text-white/35">/{v.reactionsGiven}</span>
                          </span>
                          <span className="hidden sm:block text-right text-sm text-white/85 tabular-nums">
                            {v.triviaTotal > 0 ? `${v.triviaCorrect}/${v.triviaTotal}` : "—"}
                          </span>
                          <span className="hidden sm:block text-right text-xs text-white/50 tabular-nums">
                            {timeAgo(v.updatedAt)}
                          </span>
                          {/* Chevron — rotates open via group-open. */}
                          <span className="justify-self-end text-white/40 transition-transform group-open:rotate-180">
                            ▾
                          </span>
                        </summary>
                        {/* Mobile-only quick stats row (the columns are
                            hidden below sm, so surface the numbers here
                            instead). */}
                        <ul className="sm:hidden px-3 pt-1 pb-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-white/55 tabular-nums">
                          <li>📋 {v.ballot.size}/10</li>
                          <li>💬 {v.messages}</li>
                          <li>❤️ {v.reactionsReceived}/{v.reactionsGiven}</li>
                          {v.triviaTotal > 0 && <li>🧠 {v.triviaCorrect}/{v.triviaTotal}</li>}
                          <li>{timeAgo(v.updatedAt)}</li>
                        </ul>
                        {/* Full ballot, 5 across. */}
                        <div className="px-3 pb-3 grid grid-cols-2 sm:grid-cols-5 gap-1">
                          {POINTS.map((p) => {
                            const cc = v.ballot.get(p);
                            const c = cc ? getCountry(cc) : null;
                            return (
                              <div
                                key={p}
                                className="flex items-center gap-1.5 px-2 py-1.5 rounded bg-black/30 text-xs"
                              >
                                <span className="w-5 text-flamingo font-display tabular-nums">{p}</span>
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
                        {/* Moderation strip — each row carries a delete
                            that hits the admin DELETE endpoint and
                            broadcasts. Capped at the most recent 10. */}
                        <div className="px-3 pb-3 pt-1">
                          <p className="text-[10px] uppercase tracking-[0.18em] text-white/40 font-display px-1 mb-1">
                            Recent messages
                          </p>
                          <AdminParticipantMessages code={room.code} messages={v.recent} />
                        </div>
                      </details>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        }
        settings={
          // Three groups: Identity (what the room IS), Behaviour (what it
          // DOES), and Operations (host link / wipe). One glass-card per
          // group, inner rows separated by a thin divider — instead of
          // five identical cards stacked.
          <div className="flex flex-col gap-6">
            <section className="glass-card rounded-xl p-5 flex flex-col gap-5">
              <header>
                <h2 className="font-display text-xl leading-tight">Identity</h2>
                <p className="text-xs text-white/45 mt-0.5">What this room is called and how guests join it.</p>
              </header>
              <div className="flex flex-col gap-5 divide-y divide-white/5 [&>*]:pt-5 [&>*:first-child]:pt-0">
                <div>
                  <p className="text-sm font-display text-white/85 mb-2">Room name</p>
                  <AdminRoomRename code={room.code} initialName={room.name} />
                </div>
                <div>
                  <p className="text-sm font-display text-white/85 mb-2">Join code</p>
                  <AdminRoomCode code={room.code} />
                </div>
              </div>
            </section>

            <section className="glass-card rounded-xl p-5 flex flex-col gap-3">
              <header>
                <h2 className="font-display text-xl leading-tight">Behaviour</h2>
                <p className="text-xs text-white/45 mt-0.5">Toggles that change what the room does during the show.</p>
              </header>
              {/* Each toggle already shows its own label + sub inside the
                  tile, so we drop the per-row title (it was the same
                  string twice). */}
              <AdminRoomTallyToggle code={room.code} initialEnabled={room.tallyEnabled} />
              <AdminRoomCommentatorToggle
                code={room.code}
                initialEnabled={room.commentatorEnabled}
              />
            </section>

            <section className="flex flex-col gap-4">
              <header>
                <h2 className="font-display text-xl leading-tight">Operations</h2>
                <p className="text-xs text-white/45 mt-0.5">The host magic link and the wipe-everything escape hatch.</p>
              </header>
              <AdminRoomManageLink code={room.code} adminToken={room.adminToken} />
              <AdminRoomDangerZone code={room.code} />
            </section>
          </div>
        }
      />
    </div>
  );
}

export const dynamic = "force-dynamic";
