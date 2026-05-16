"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Flag } from "@/components/flag";
import { getCountry } from "@/lib/countries";
import { timeAgo } from "@/lib/utils";
import { AdminParticipantMessages } from "@/components/admin-participant-messages";
import { AdminRemoveParticipant } from "@/components/admin-remove-participant";
import { AdminRecoveryLink } from "@/components/admin-recovery-link";

const POINTS = [12, 10, 8, 7, 6, 5, 4, 3, 2, 1] as const;

export type AdminMessageRow = {
  id: string;
  kind: string;
  body: string | null;
  gifUrl: string | null;
  createdAt: string;
};

export type AdminVoterRow = {
  id: string;
  name: string;
  sessionId: string;
  // ISO string (we serialise from the Date on the server so this
  // component is happy as a client/RSC boundary).
  updatedAt: string;
  messages: number;
  reactionsGiven: number;
  reactionsReceived: number;
  triviaCorrect: number;
  triviaTotal: number;
  /** Score from the leaderboard rollup. null when tally is off or
   *  this voter doesn't have a leaderboard row (e.g. zero activity). */
  score: number | null;
  /** points → countryCode map; sparse, zero or more of POINTS. */
  ballot: Record<number, string>;
  recent: AdminMessageRow[];
};

type SortKey =
  | "name"
  | "ballot"
  | "messages"
  | "reactions"
  | "trivia"
  | "score"
  | "active";

type SortDir = "asc" | "desc";

// Default direction per column — for counts/scores "desc" is the
// natural "best first" view; for name it's alphabetical asc; for
// "active" it's most-recently-active first (desc on the timestamp).
const DEFAULT_DIR: Record<SortKey, SortDir> = {
  name: "asc",
  ballot: "desc",
  messages: "desc",
  reactions: "desc",
  trivia: "desc",
  score: "desc",
  active: "desc",
};

// Comparable scalar for each column. For "trivia" we compare on
// correct count, breaking ties on total answered. Reactions sort on
// received+given combined so the column header semantically matches
// the displayed "in/out" pair.
function valueFor(v: AdminVoterRow, key: SortKey): number | string {
  switch (key) {
    case "name":
      return v.name?.toLocaleLowerCase() ?? "";
    case "ballot":
      return Object.keys(v.ballot).length;
    case "messages":
      return v.messages;
    case "reactions":
      return v.reactionsReceived + v.reactionsGiven;
    case "trivia":
      return v.triviaCorrect * 1000 + v.triviaTotal;
    case "score":
      return v.score ?? -Infinity;
    case "active":
      return new Date(v.updatedAt).getTime();
  }
}

export function AdminParticipantsTable({
  code,
  voters,
  tallyEnabled,
}: {
  code: string;
  voters: AdminVoterRow[];
  /** Show the Score column only when the room has the tally on. */
  tallyEnabled: boolean;
}) {
  // Default sort: most-recently-active first if tally is off (matches
  // the old server-side ordering); by score desc when tally is on
  // (the column that matters most for the show).
  const [sortKey, setSortKey] = useState<SortKey>(tallyEnabled ? "score" : "active");
  const [sortDir, setSortDir] = useState<SortDir>(
    DEFAULT_DIR[tallyEnabled ? "score" : "active"],
  );

  const sorted = useMemo(() => {
    const rows = voters.slice();
    rows.sort((a, b) => {
      const av = valueFor(a, sortKey);
      const bv = valueFor(b, sortKey);
      let cmp = 0;
      if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
      else cmp = String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [voters, sortKey, sortDir]);

  const cycle = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(DEFAULT_DIR[key]);
    }
  };

  // Grid template adapts to whether the Score column is on.
  // Mobile keeps name + chevron only; the rest of the numbers fall
  // back to the inline chip strip inside each expanded row.
  const cols = tallyEnabled
    ? "sm:grid-cols-[minmax(0,1fr)_64px_72px_60px_88px_72px_76px_28px]"
    : "sm:grid-cols-[minmax(0,1fr)_72px_60px_88px_72px_76px_28px]";

  return (
    <div className="rounded-lg bg-white/[0.03] border border-white/8 overflow-hidden backdrop-blur-md backdrop-saturate-150 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      {/* Column labels — every column is a clickable sort toggle now.
          Active column gets a chevron indicating direction. */}
      <div
        className={`hidden sm:grid grid-cols-[minmax(0,1fr)_28px] ${cols} gap-3 px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-white/40 font-display bg-white/[0.03] border-b border-white/5`}
      >
        <HeaderButton label="Name" col="name" current={sortKey} dir={sortDir} onClick={cycle} align="left" />
        {tallyEnabled && (
          <HeaderButton label="Score" col="score" current={sortKey} dir={sortDir} onClick={cycle} />
        )}
        <HeaderButton label="Ballot" col="ballot" current={sortKey} dir={sortDir} onClick={cycle} />
        <HeaderButton label="Msgs" col="messages" current={sortKey} dir={sortDir} onClick={cycle} />
        <HeaderButton label="❤️ in/out" col="reactions" current={sortKey} dir={sortDir} onClick={cycle} />
        <HeaderButton label="Trivia" col="trivia" current={sortKey} dir={sortDir} onClick={cycle} />
        <HeaderButton label="Active" col="active" current={sortKey} dir={sortDir} onClick={cycle} />
        <span />
      </div>
      <ul className="divide-y divide-white/5">
        {sorted.map((v) => (
          <li key={v.id}>
            <details className="group">
              <summary
                className={`grid grid-cols-[minmax(0,1fr)_28px] ${cols} items-center gap-3 px-3 py-2.5 cursor-pointer list-none hover:bg-white/[0.02] transition`}
              >
                <span className="font-display truncate">{v.name}</span>
                {tallyEnabled && (
                  <span className="hidden sm:block text-right text-sm text-white tabular-nums font-display">
                    {v.score ?? <span className="text-white/30">—</span>}
                  </span>
                )}
                <span className="hidden sm:block text-right text-sm text-white/85 tabular-nums">
                  {Object.keys(v.ballot).length}
                  <span className="text-white/35">/10</span>
                </span>
                <span className="hidden sm:block text-right text-sm text-white/85 tabular-nums">
                  {v.messages}
                </span>
                <span className="hidden sm:block text-right text-sm text-white/85 tabular-nums">
                  {v.reactionsReceived}
                  <span className="text-white/35">/{v.reactionsGiven}</span>
                </span>
                <span className="hidden sm:block text-right text-sm text-white/85 tabular-nums">
                  {v.triviaTotal > 0 ? `${v.triviaCorrect}/${v.triviaTotal}` : "—"}
                </span>
                <span className="hidden sm:block text-right text-xs text-white/50 tabular-nums">
                  {timeAgo(v.updatedAt)}
                </span>
                <span className="justify-self-end text-white/40 transition-transform group-open:rotate-180">
                  ▾
                </span>
              </summary>
              <ul className="sm:hidden px-3 pt-1 pb-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-white/55 tabular-nums">
                {tallyEnabled && v.score != null && <li>🏆 {v.score}</li>}
                <li>📋 {Object.keys(v.ballot).length}/10</li>
                <li>💬 {v.messages}</li>
                <li>❤️ {v.reactionsReceived}/{v.reactionsGiven}</li>
                {v.triviaTotal > 0 && <li>🧠 {v.triviaCorrect}/{v.triviaTotal}</li>}
                <li>{timeAgo(v.updatedAt)}</li>
              </ul>
              <div className="px-3 pb-3 grid grid-cols-2 sm:grid-cols-5 gap-1">
                {POINTS.map((p) => {
                  const cc = v.ballot[p];
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
              <div className="px-3 pb-3 pt-1">
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/40 font-display px-1 mb-1">
                  Recent messages
                </p>
                <AdminParticipantMessages code={code} messages={v.recent} />
              </div>
              <div className="px-3 pb-3 pt-1 flex items-center justify-between gap-3 border-t border-white/5">
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/35 font-display shrink-0">
                  Recovery
                </p>
                <AdminRecoveryLink code={code} sessionId={v.sessionId} />
              </div>
              <div className="px-3 pb-3 pt-1 flex items-center justify-between gap-3 border-t border-white/5">
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/35 font-display">
                  Suspend
                </p>
                <AdminRemoveParticipant code={code} sessionId={v.sessionId} name={v.name} />
              </div>
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}

function HeaderButton({
  label,
  col,
  current,
  dir,
  onClick,
  align = "right",
}: {
  label: string;
  col: SortKey;
  current: SortKey;
  dir: SortDir;
  onClick: (col: SortKey) => void;
  align?: "left" | "right";
}) {
  const active = current === col;
  const justify = align === "right" ? "justify-end" : "justify-start";
  return (
    <button
      type="button"
      onClick={() => onClick(col)}
      className={`flex items-center gap-1 ${justify} ${
        active ? "text-white" : "text-white/40 hover:text-white/65"
      } transition cursor-pointer`}
    >
      <span>{label}</span>
      {active &&
        (dir === "asc" ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        ))}
    </button>
  );
}
