"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion } from "motion/react";
import { Mic, Music, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { countries, getCountry, countryName } from "@/lib/countries";
import { useEventListener } from "@/lib/realtime";
import { HeartFlag, MetaPill } from "@/components/flag";
import { useRoomLive, useRoomTab } from "@/components/room-shell";
import { useCountryDeepDive } from "@/components/country-deep-dive";
import { t } from "@/lib/i18n";
import { useLang } from "@/lib/i18n-client";

type ScoreRow = {
  code: string;
  name: string;
  totalPoints: number;
};

type ScoresResponse = {
  scores: ScoreRow[];
};

export function Standings() {
  const { code, votingEnabled, tallyEnabled } = useRoomLive();
  const lang = useLang();

  const [scores, setScores] = useState<ScoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeAllOpen, setSeeAllOpen] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);

  const fetchScores = useCallback(async () => {
    try {
      const res = await fetch(`/api/rooms/${code}/scores`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as ScoresResponse;
      setScores(data.scores);
    } finally {
      setLoading(false);
    }
  }, [code]);

  // Initial load only. The primary update path is the
  // `scores:updated` broadcast; an extra 60s poll on top of N
  // viewers turns into thousands of pointless GETs during the
  // show. If the websocket drops, the next vote / broadcast will
  // re-trigger anyway, and a stale snapshot for a minute is
  // acceptable.
  useEffect(() => {
    fetchScores();
  }, [fetchScores]);

  // Coalesce vote-storm broadcasts. Each ballot save fans out
  // `scores:updated` to every viewer; 50 viewers × 50 ballots tweaked
  // during the voting window = 2500 GETs to /scores. A 2s leading-
  // throttle collapses any vote storm to a single refetch per 2s
  // per client — the snapshot stays roughly current without us
  // hammering the endpoint.
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEventListener(({ event }) => {
    if (event.type !== "scores:updated") return;
    if (refetchTimer.current) return;
    refetchTimer.current = setTimeout(() => {
      refetchTimer.current = null;
      fetchScores();
    }, 2_000);
  });
  useEffect(() => {
    return () => {
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
    };
  }, []);

  useEffect(() => {
    setHasVoted(localStorage.getItem(`uzk_voted_${code}`) === "1");
  }, [code]);

  const allWithZero = (() => {
    const map = new Map(scores.map((s) => [s.code, s]));
    return countries
      .map((c) => map.get(c.code) ?? { code: c.code, name: c.name, totalPoints: 0 })
      .sort((a, b) => {
        if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
        return (getCountry(a.code)?.order ?? 999) - (getCountry(b.code)?.order ?? 999);
      });
  })();

  const visible = scores.slice(0, 5);

  // Fan TOP 5 only makes sense while there's something to react to:
  // either voting is open (live aggregate of in-progress ballots) OR
  // the host has revealed the official results. Outside those windows
  // the widget is just a stale snapshot and clutters Home.
  if (!votingEnabled && !tallyEnabled) return null;

  return (
    <main id="standings" className="container mx-auto max-w-3xl px-4 scroll-mt-16">
      {/* Widget surface — a calm dark wrapper instead of the loose-rows
          + rainbow-gradient title we had. The home page is rich with
          colour banners above (vote hero, bingo, vs-room, bonus); the
          TOP 5 sits between those and the quieter "akcentai / who's
          here" stack below, so it needs to dial back the saturation
          without disappearing. Single ring + a faint top gloss is
          enough. The `#standings` anchor moved up from a wrapper in
          home-panel.tsx so that anchor doesn't leave a phantom 16px
          gap on rooms where the widget self-hides. */}
      <section
        className="relative overflow-hidden rounded-3xl ring-1 ring-white/10
                   bg-gradient-to-b from-dark-blue-900/85 to-dark-blue-900/65
                   shadow-[0_10px_30px_-22px_rgba(0,0,0,0.6)]
                   p-4 flex flex-col gap-3"
      >
        <span
          className="pointer-events-none absolute inset-x-0 top-0 h-1/4"
          style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.06), transparent)" }}
          aria-hidden
        />
        {/* Award-style title: gold-gradient text flanked by sparkle
            glyphs. Same "the moment matters" energy as a movie-award
            laurel without us shipping a vector laurel SVG. The
            gradient runs top → bottom (light → deep gold) so the row
            below it still reads. */}
        <h2 className="relative flex items-center justify-center gap-3 px-1 select-none">
          <Sparkles
            className="h-4 w-4 shrink-0 text-[#f4c869]"
            fill="currentColor"
            aria-hidden
          />
          <span
            // `leading-none` was clipping the dot on Ė (Lithuanian's
            // capital-with-overdot eats vertical space above the cap
            // line). `leading-[1.15]` gives the diacritic room without
            // changing the visual centring of the row. Also keep
            // `pt-[2px]` so the text sits true to the sparkle icons
            // either side.
            className="font-display text-lg uppercase tracking-[0.22em] leading-[1.15] pt-[2px] bg-clip-text text-transparent drop-shadow-[0_1px_0_rgba(0,0,0,0.35)]"
            style={{
              backgroundImage:
                "linear-gradient(180deg, #fff3c2 0%, #f4c869 45%, #c98a2f 100%)",
            }}
          >
            {t(lang, "fan_top5")}
          </span>
          <Sparkles
            className="h-4 w-4 shrink-0 text-[#f4c869]"
            fill="currentColor"
            aria-hidden
          />
        </h2>
      {loading ? (
        <ul className="flex flex-col gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <li
              key={i}
              className="glass-card rounded-2xl px-3 py-2.5 flex items-center gap-3 opacity-60"
            >
              <span className="h-9 w-9 rounded-full bg-white/8 skeleton" />
              <span className="h-7 w-24 rounded-full bg-white/8 skeleton" />
              <span className="flex-1" />
              <span className="h-7 w-10 rounded-md bg-white/8 skeleton" />
            </li>
          ))}
        </ul>
      ) : visible.length === 0 ? (
        <NoVotesYet votingEnabled={votingEnabled} lang={lang} hasVoted={hasVoted} />
      ) : (
        // Static on the Home screen — it's a thing you glance at, not a
        // show. The animated cascade lives in the "see all" drawer.
        <ol className="flex flex-col gap-2">
          {visible.map((s, i) => (
            <CountryRow key={s.code} score={s} index={i} lang={lang} />
          ))}
        </ol>
      )}

      {scores.length > 0 && (
        <button
          type="button"
          onClick={() => setSeeAllOpen(true)}
          className="self-center mt-1 px-4 h-9 rounded-full font-display text-sm
                     text-white/80 bg-white/5 ring-1 ring-white/10
                     active:bg-white/10 transition"
        >
          {t(lang, "see_all")} ({countries.length})
        </button>
      )}

      {/* Full standings — all competing countries, 0-vote ones included.
          Rows cascade in one by one when the sheet opens. */}
      <BottomSheet open={seeAllOpen} onClose={() => setSeeAllOpen(false)} title={t(lang, "standings")}>
        <ol className="flex flex-col gap-2">
          {allWithZero.map((s, i) => (
            <CountryRow
              key={s.code}
              score={s}
              index={i}
              lang={lang}
              delay={Math.min(i, 28) * 0.022}
            />
          ))}
        </ol>
      </BottomSheet>
      </section>
    </main>
  );
}

function NoVotesYet({
  votingEnabled,
  lang,
  hasVoted,
}: {
  votingEnabled: boolean;
  lang: "en" | "lt";
  hasVoted: boolean;
}) {
  const { setTab } = useRoomTab();
  const placeholders = [0, 1, 2];
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col gap-5 py-6"
    >
      <div className="flex flex-col items-center text-center gap-3">
        <motion.div
          animate={{ scale: [1, 1.18, 1, 1.1, 1] }}
          transition={{
            duration: 1.1,
            times: [0, 0.18, 0.36, 0.5, 1],
            repeat: Infinity,
            repeatDelay: 0.5,
            ease: "easeInOut",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/70-heart.webp"
            alt=""
            className="h-20 w-20 object-contain drop-shadow-[0_0_24px_rgba(255,46,222,0.35)]"
          />
        </motion.div>
        <h3 className="font-display text-2xl text-white/90 text-balance">{t(lang, "no_votes_yet")}</h3>
        <p className="text-sm text-white/50 max-w-xs text-balance">{t(lang, "no_votes_sub")}</p>
      </div>

      <ul className="flex flex-col gap-2">
        {placeholders.map((i) => (
          <li
            key={i}
            className="glass-card rounded-2xl px-3 py-2.5 flex items-center gap-3 opacity-50"
          >
            <span className="h-9 w-9 rounded-full bg-white/8" />
            <span className="h-7 flex-1 max-w-[8rem] rounded-full bg-white/8" />
            <span className="h-6 w-8 rounded-md bg-white/8" />
          </li>
        ))}
      </ul>

      {votingEnabled && (
        <button
          type="button"
          onClick={() => setTab("vote")}
          className="rainbow-border rounded-2xl mx-auto w-full max-w-xs block"
        >
          <Button
            asChild
            className="w-full h-12 text-base font-display rounded-[14px] bg-white text-dark-blue hover:bg-dark-blue-50"
          >
            <span>{hasVoted ? t(lang, "update_vote") : t(lang, "be_the_first")}</span>
          </Button>
        </button>
      )}
    </motion.div>
  );
}

function CountryRow({
  score,
  index,
  lang,
  delay = null,
}: {
  score: ScoreRow;
  index: number;
  lang: "en" | "lt";
  /** When non-null this row fades/slides in at that delay (the drawer);
   *  null = render static (the Home list). */
  delay?: number | null;
}) {
  const detail = getCountry(score.code);
  const deepDive = useCountryDeepDive();
  // Top-3 keep a richer treatment — bigger padding, gold/silver/bronze
  // ring + brand glow, score in the brand colour. (Static styling, not
  // an animation.)
  const podium =
    index === 0
      ? "ring-2 ring-yellow shadow-[0_0_24px_-8px_oklch(95%_0.19_108_/_0.65)]"
      : index === 1
        ? "ring-2 ring-white/70 shadow-[0_0_18px_-10px_rgba(255,255,255,0.55)]"
        : index === 2
          ? "ring-2 ring-orange shadow-[0_0_18px_-10px_oklch(70%_0.19_42_/_0.6)]"
          : "";
  const scoreColor =
    index === 0 ? "oklch(95% 0.19 108)"
      : index === 1 ? "oklch(98% 0 0)"
        : index === 2 ? "oklch(70% 0.19 42)"
          : "oklch(70.55% 0.2725 336.19)";

  const className = `relative glass-card rounded-2xl flex items-center gap-3 cursor-pointer
                     ${index < 3 ? "px-3.5 py-3.5" : "px-3 py-2.5"} ${podium}`;
  const open = () => deepDive.open(score.code);
  const handlers = {
    onClick: open,
    role: "button" as const,
    tabIndex: 0,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open();
      }
    },
  };
  const inner = (
    <>
      <HeartFlag code={score.code} name={countryName(score.code, lang)} size={index === 0 ? "lg" : "md"} />
      <div className="hidden sm:flex flex-1 min-w-0 items-center gap-1.5 overflow-hidden">
        {detail?.artist && (
          <MetaPill icon={Mic} className="truncate max-w-[12rem]">
            <span className="truncate">{detail.artist}</span>
          </MetaPill>
        )}
        {detail?.song && (
          <MetaPill icon={Music} className="truncate max-w-[14rem]">
            <span className="truncate italic">{detail.song}</span>
          </MetaPill>
        )}
      </div>
      <div className="flex-1 sm:hidden" />
      <p className="shrink-0 font-display text-2xl tabular-nums leading-none" style={{ color: scoreColor }}>
        {score.totalPoints}
      </p>
    </>
  );

  if (delay == null) {
    return (
      <li {...handlers} className={className}>
        {inner}
      </li>
    );
  }
  return (
    <motion.li
      {...handlers}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {inner}
    </motion.li>
  );
}
