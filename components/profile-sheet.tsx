"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { MessageCircle, Heart, Flame, Sparkles, Dices, HelpCircle as TriviaIcon, Lock } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Flag, HeartFlag } from "@/components/flag";
import { getAvatar } from "@/lib/avatars";
import { optimizedSrc } from "@/lib/img";
import { useRoomLive } from "@/components/room-shell";
import { useIdentity } from "@/lib/use-identity";
import { countryName, getCountry } from "@/lib/countries";
import { t } from "@/lib/i18n";
import { useLang } from "@/lib/i18n-client";

// "Tap an avatar, see who they are" — the participant profile drawer.
//
// Exposes the same provider-pattern as <CountryDeepDiveProvider>: any
// descendant can call `useProfile().open(sessionId, seed?)`. Keeps the
// sheet mounted once at the room shell instead of giving every bubble
// its own hook + state. Loads the data on each open from the profile
// API; the API gates the ballot section behind tallyEnabled / self-view.
// `seed` lets a caller (e.g. the whos-here honeycomb) pass presence
// name+avatar so the sheet has something to render even when the
// participant hasn't cast a vote or sent a chat message yet.

type ProfileSeed = { name?: string; avatarId?: string | null };

type Ctx = {
  open: (sessionId: string, seed?: ProfileSeed) => void;
  close: () => void;
};

const Context = createContext<Ctx | null>(null);

export function useProfile(): Ctx {
  return useContext(Context) ?? { open: () => {}, close: () => {} };
}

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [target, setTarget] = useState<
    { sessionId: string; seed: ProfileSeed } | null
  >(null);
  const value = useMemo<Ctx>(
    () => ({
      open: (s, seed) => setTarget({ sessionId: s, seed: seed ?? {} }),
      close: () => setTarget(null),
    }),
    [],
  );
  return (
    <Context.Provider value={value}>
      {children}
      <ProfileSheet
        sessionId={target?.sessionId ?? null}
        seed={target?.seed ?? {}}
        onClose={() => setTarget(null)}
      />
    </Context.Provider>
  );
}

type BallotPick = {
  points: number;
  countryCode: string;
  officialPlacement: number | null;
  earned: number;
};

type ProfileData = {
  sessionId: string;
  name: string;
  avatarId: string | null;
  joinedAt: string | null;
  lastActiveAt: string | null;
  stats: {
    messages: number;
    reactionsGiven: number;
    reactionsReceived: number;
    highlights: number;
    bingoStrikes: number;
    bets: number;
    triviaCorrect: number;
    triviaTotal: number;
  };
  ballot: BallotPick[] | null;
  ballotHidden: boolean;
  topHighlight: {
    id: string;
    body: string | null;
    gifUrl: string | null;
    kind: string;
    reactionCount: number;
  } | null;
};

function ProfileSheet({
  sessionId,
  seed,
  onClose,
}: {
  sessionId: string | null;
  seed: ProfileSeed;
  onClose: () => void;
}) {
  const { code } = useRoomLive();
  const lang = useLang();
  const { sessionId: getSession } = useIdentity();
  const mySession = getSession();
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [shellOnly, setShellOnly] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      setData(null);
      setShellOnly(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setShellOnly(false);
    fetch(
      `/api/rooms/${code}/profile/${encodeURIComponent(sessionId)}?as=${encodeURIComponent(mySession)}`,
      { cache: "no-store" },
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        if (!d) setShellOnly(true);
        else setData(d as ProfileData);
      })
      .catch(() => {
        if (!cancelled) setShellOnly(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, code, mySession]);

  // "Shell" view: API returned 404 (no chat messages, no vote) but we
  // still know who they are from the bubble that opened this drawer.
  // Show their identity + a friendly "they're here but haven't done
  // anything yet" line instead of failing closed.
  const shell: ProfileData | null = useMemo(() => {
    if (!sessionId || !shellOnly) return null;
    return {
      sessionId,
      name: seed.name ?? "—",
      avatarId: seed.avatarId ?? null,
      joinedAt: null,
      lastActiveAt: null,
      stats: {
        messages: 0,
        reactionsGiven: 0,
        reactionsReceived: 0,
        highlights: 0,
        bingoStrikes: 0,
        bets: 0,
        triviaCorrect: 0,
        triviaTotal: 0,
      },
      ballot: null,
      ballotHidden: false,
      topHighlight: null,
    };
  }, [sessionId, shellOnly, seed.name, seed.avatarId]);

  const view = data ?? shell;
  const avatar = view?.avatarId ? getAvatar(view.avatarId) : null;
  const isSelf = !!sessionId && sessionId === mySession;

  return (
    <BottomSheet open={!!sessionId} onClose={onClose} title={view?.name ?? ""}>
      {loading && !view && (
        <p className="text-sm text-white/45 text-center py-6">{t(lang, "profile_loading")}</p>
      )}
      {view && (
        <div className="flex flex-col gap-4">
          {/* Identity hero */}
          <div className="flex items-center gap-3 rounded-2xl bg-white/[0.04] ring-1 ring-white/8 px-4 py-3">
            <span className="h-16 w-16 shrink-0 rounded-2xl overflow-hidden ring-1 ring-white/15 bg-white/[0.06]">
              {avatar?.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={optimizedSrc(avatar.photo, 256)}
                  alt=""
                  className="h-full w-full object-cover"
                  style={{
                    objectPosition: avatar.focal
                      ? `${avatar.focal.x}% ${avatar.focal.y}%`
                      : "50% 30%",
                  }}
                />
              ) : (
                <span className="h-full w-full grid place-items-center text-2xl font-display text-white/55">
                  {view.name.charAt(0).toUpperCase()}
                </span>
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-lg truncate flex items-center gap-1.5">
                {view.name}
                {isSelf && (
                  <span className="text-[10px] uppercase tracking-[0.2em] text-flamingo font-display">
                    {t(lang, "profile_you")}
                  </span>
                )}
              </p>
              {avatar && (
                <p className="text-xs text-white/55 leading-snug truncate">
                  {t(lang, "profile_picked_artist")} · {avatar.artist} · {avatar.year}
                </p>
              )}
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-2">
            <StatTile icon={MessageCircle} label={t(lang, "profile_stat_messages")} value={view.stats.messages} />
            <StatTile icon={Heart} label={t(lang, "profile_stat_loves")} value={view.stats.reactionsReceived} fillIcon />
            <StatTile icon={Flame} label={t(lang, "profile_stat_highlights")} value={view.stats.highlights} fillIcon />
            <StatTile icon={Sparkles} label={t(lang, "profile_stat_bingo")} value={view.stats.bingoStrikes} />
            <StatTile icon={Dices} label={t(lang, "profile_stat_bets")} value={view.stats.bets} />
            {/* Trivia: show "correct / total" so the denominator gives
                context. Hidden if the player hasn't attempted any. */}
            {view.stats.triviaTotal > 0 ? (
              <StatTile
                icon={TriviaIcon}
                label={t(lang, "profile_stat_trivia")}
                value={view.stats.triviaCorrect}
                suffix={`/${view.stats.triviaTotal}`}
              />
            ) : (
              <StatTile icon={Heart} label={t(lang, "profile_stat_given")} value={view.stats.reactionsGiven} muted />
            )}
          </div>

          {/* Top highlight */}
          {view.topHighlight && (
            <div className="rounded-2xl bg-orange/[0.07] ring-1 ring-orange/20 px-3 py-3 flex items-center gap-3">
              <span className="h-9 w-9 shrink-0 rounded-xl bg-orange/15 ring-1 ring-orange/35 grid place-items-center text-orange">
                <Flame className="h-4 w-4" fill="currentColor" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-[0.2em] text-orange/90 font-display">
                  {t(lang, "profile_top_moment")}
                </p>
                {view.topHighlight.body ? (
                  <p className="text-sm text-white/90 truncate">{view.topHighlight.body}</p>
                ) : view.topHighlight.gifUrl ? (
                  <p className="text-sm text-white/70 italic">GIF</p>
                ) : view.topHighlight.kind === "bingo_strike" ? (
                  <p className="text-sm text-white/85">🎯 Bingo!</p>
                ) : null}
              </div>
              <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-orange/15 ring-1 ring-orange/35 px-2 h-6 text-xs text-orange tabular-nums font-display">
                ❤️ {view.topHighlight.reactionCount}
              </span>
            </div>
          )}

          {/* TOP 10 — either rendered (with per-pick scoring), or a
              "hidden until reveal" placeholder if results aren't out
              and we're not looking at our own profile. */}
          <BallotSection
            ballot={view.ballot}
            hidden={view.ballotHidden}
            lang={lang}
          />
        </div>
      )}
    </BottomSheet>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  suffix,
  fillIcon,
  muted,
}: {
  icon: typeof MessageCircle;
  label: string;
  value: number;
  /** Appended after the value (e.g. "/7" for trivia "3 / 7"). */
  suffix?: string;
  fillIcon?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-3
                  ${muted ? "bg-white/[0.025] ring-1 ring-white/8 text-white/55" : "bg-white/[0.04] ring-1 ring-white/8 text-white/85"}`}
    >
      <Icon className="h-4 w-4" {...(fillIcon ? { fill: "currentColor" } : {})} />
      <span className="font-display text-xl tabular-nums leading-none">
        {value}
        {suffix && <span className="text-white/55 text-sm">{suffix}</span>}
      </span>
      <span className="text-[10px] uppercase tracking-[0.15em] text-white/45 font-display leading-none text-center">
        {label}
      </span>
    </div>
  );
}

function BallotSection({
  ballot,
  hidden,
  lang,
}: {
  ballot: BallotPick[] | null;
  hidden: boolean;
  lang: "en" | "lt";
}) {
  if (hidden) {
    return (
      <div className="rounded-2xl bg-white/[0.03] ring-1 ring-white/8 px-4 py-3 flex items-center gap-3">
        <Lock className="h-4 w-4 text-white/45 shrink-0" />
        <p className="text-sm text-white/55 leading-snug">{t(lang, "profile_top10_hidden")}</p>
      </div>
    );
  }
  if (!ballot || ballot.length === 0) return null;
  const filled = ballot.filter((b) => b.countryCode);
  if (filled.length === 0) {
    return (
      <p className="text-sm text-white/45 text-center py-2">{t(lang, "profile_top10_empty")}</p>
    );
  }
  // Did we resolve any official placements? Then it's the reveal view
  // (show finished-at, scored points). Otherwise it's a quiet "here are
  // their picks" listing.
  const hasResults = ballot.some((b) => b.officialPlacement != null);
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-[11px] uppercase tracking-[0.2em] text-white/45 font-display px-1">
        {t(lang, "profile_top10_h")}
      </h3>
      <ol className="flex flex-col gap-1.5">
        {ballot.map((pick) => (
          <BallotRow key={pick.points} pick={pick} hasResults={hasResults} lang={lang} />
        ))}
      </ol>
    </section>
  );
}

function BallotRow({
  pick,
  hasResults,
  lang,
}: {
  pick: BallotPick;
  hasResults: boolean;
  lang: "en" | "lt";
}) {
  const country = pick.countryCode ? getCountry(pick.countryCode) : null;
  return (
    <li
      className={`flex items-center gap-3 rounded-2xl px-3 py-2
                  ${pick.earned > 0 ? "bg-flamingo/10 ring-1 ring-flamingo/25" : "bg-white/[0.04] ring-1 ring-white/8"}`}
    >
      <span
        className={`shrink-0 h-9 w-9 grid place-items-center rounded-lg font-display text-base tabular-nums
                    ${
                      pick.points === 12
                        ? "bg-gradient-to-br from-gold to-orange text-dark-blue"
                        : pick.points === 10
                          ? "bg-gradient-to-br from-flamingo to-fuchsia text-white"
                          : pick.points === 8
                            ? "bg-gradient-to-br from-orange to-flamingo text-white"
                            : "bg-white/[0.07] ring-1 ring-white/12 text-white/80"
                    }`}
      >
        {pick.points}
      </span>
      {country ? (
        <HeartFlag code={country.code} size="sm" />
      ) : (
        <span className="h-6 w-8 rounded-[3px] bg-white/5 border border-dashed border-white/15" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-display truncate">
          {country ? countryName(country.code, lang) : "—"}
        </p>
        {hasResults && country && (
          <p className="text-[11px] text-white/55 truncate">
            {pick.officialPlacement != null
              ? t(lang, "profile_top10_finished", pick.officialPlacement)
              : t(lang, "profile_top10_unranked")}
          </p>
        )}
      </div>
      {hasResults && (
        <span
          className={`shrink-0 font-display tabular-nums text-sm ${
            pick.earned > 0 ? "text-flamingo" : "text-white/30"
          }`}
        >
          {pick.earned > 0 ? `+${pick.earned}` : "—"}
        </span>
      )}
    </li>
  );
}
