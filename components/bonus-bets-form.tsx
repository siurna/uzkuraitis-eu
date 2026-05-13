"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { ChevronRight } from "lucide-react";
import { Flag, HeartFlag } from "@/components/flag";
import { CountryDrawer } from "@/components/country-drawer";
import { getCountry, countryName } from "@/lib/countries";
import { BIG_5, HOST_COUNTRY, type Bets } from "@/lib/scoring";
import { t, fmt } from "@/lib/i18n";
import { useLang } from "@/lib/i18n-client";

const NONE_TOKEN = "NONE";

// Side bets stack. Each row is a single tap-to-pick card; tapping opens a
// bottom-sheet drawer showing full country info (flag + artist + song)
// instead of cramming a tiny <select>. Multi-pick mode used for nul-points
// televote.
export function BonusBetsForm({
  homeCountryCode,
  bets,
  onChange,
}: {
  homeCountryCode: string;
  bets: Bets;
  onChange: (next: Bets) => void;
}) {
  const home = getCountry(homeCountryCode);
  const lang = useLang();
  const homeName = countryName(homeCountryCode, lang);
  const hostName = countryName(HOST_COUNTRY, lang);

  // Track which row's drawer is open via a discriminated key.
  const [drawerKey, setDrawerKey] = useState<keyof Bets | null>(null);

  const set = <K extends keyof Bets>(k: K, v: Bets[K]) =>
    onChange({ ...bets, [k]: v });

  return (
    // Rows ordered by best-case payout, biggest first — same order as the
    // Rules tab's bonus-bets list.
    <div className="flex flex-col gap-3">
      {home && (
        <NumberRow
          label={fmt(t(lang, "bet_lt_total"), { home: homeName })}
          sub={fmt(t(lang, "bet_lt_total_sub"), { home: homeName })}
          max={10}
          value={bets.ltTotalPoints ?? null}
          onChange={(v) => set("ltTotalPoints", v)}
        />
      )}

      <CountryRow
        label={t(lang, "bet_jury_winner")}
        sub={t(lang, "bet_jury_winner_sub")}
        max={5}
        value={bets.juryWinner ?? null}
        onOpen={() => setDrawerKey("juryWinner")}
      />

      <CountryRow
        label={t(lang, "bet_televote_winner")}
        sub={t(lang, "bet_televote_winner_sub")}
        max={5}
        value={bets.televoteWinner ?? null}
        onOpen={() => setDrawerKey("televoteWinner")}
      />

      <CountryRow
        label={t(lang, "bet_wooden_spoon")}
        sub={t(lang, "bet_wooden_spoon_sub")}
        max={5}
        value={bets.woodenSpoon ?? null}
        onOpen={() => setDrawerKey("woodenSpoon")}
      />

      {home && (
        <CountryRow
          label={fmt(t(lang, "bet_lt_12_to"), { home: homeName })}
          sub={fmt(t(lang, "bet_lt_12_to_sub"), { home: homeName })}
          max={5}
          value={bets.lt12To ?? null}
          onOpen={() => setDrawerKey("lt12To")}
        />
      )}

      <MultiCountryRow
        label={t(lang, "bet_nul")}
        sub={t(lang, "bet_nul_sub")}
        value={bets.nulTelevote ?? []}
        onOpen={() => setDrawerKey("nulTelevote")}
      />

      <CountryRow
        label={t(lang, "bet_big5")}
        sub={t(lang, "bet_big5_sub")}
        max={3}
        value={bets.highestBig5 ?? null}
        onOpen={() => setDrawerKey("highestBig5")}
      />

      <YesNoRow
        label={fmt(t(lang, "bet_host_top3"), { host: hostName })}
        sub={fmt(t(lang, "bet_host_top3_sub"), { host: hostName })}
        max={3}
        value={bets.hostTop3 ?? null}
        onChange={(v) => set("hostTop3", v)}
        lang={lang}
      />

      <YesNoRow
        label={t(lang, "bet_solo_winner")}
        sub={t(lang, "bet_solo_winner_sub")}
        max={2}
        value={bets.winnerSolo ?? null}
        onChange={(v) => set("winnerSolo", v)}
        lang={lang}
      />

      {/* Drawers: only one mounted at a time. Same order as the rows above. */}
      <CountryDrawer
        title={t(lang, "bet_jury_winner")}
        sub={t(lang, "bet_jury_winner_sub")}
        open={drawerKey === "juryWinner"}
        onClose={() => setDrawerKey(null)}
        selected={bets.juryWinner ? [bets.juryWinner] : []}
        onPick={(v) =>
          set("juryWinner", typeof v === "string" ? v : null)
        }
      />
      <CountryDrawer
        title={t(lang, "bet_televote_winner")}
        sub={t(lang, "bet_televote_winner_sub")}
        open={drawerKey === "televoteWinner"}
        onClose={() => setDrawerKey(null)}
        selected={bets.televoteWinner ? [bets.televoteWinner] : []}
        onPick={(v) =>
          set("televoteWinner", typeof v === "string" ? v : null)
        }
      />
      <CountryDrawer
        title={t(lang, "bet_wooden_spoon")}
        sub={t(lang, "bet_wooden_spoon_sub")}
        open={drawerKey === "woodenSpoon"}
        onClose={() => setDrawerKey(null)}
        selected={bets.woodenSpoon ? [bets.woodenSpoon] : []}
        onPick={(v) =>
          set("woodenSpoon", typeof v === "string" ? v : null)
        }
      />
      {home && (
        <CountryDrawer
          title={fmt(t(lang, "bet_lt_12_to"), { home: homeName })}
          sub={fmt(t(lang, "bet_lt_12_to_sub"), { home: homeName })}
          open={drawerKey === "lt12To"}
          onClose={() => setDrawerKey(null)}
          selected={bets.lt12To ? [bets.lt12To] : []}
          onPick={(v) => set("lt12To", typeof v === "string" ? v : null)}
        />
      )}
      <CountryDrawer
        title={t(lang, "bet_nul")}
        sub={t(lang, "bet_nul_sub")}
        open={drawerKey === "nulTelevote"}
        onClose={() => setDrawerKey(null)}
        selected={bets.nulTelevote ?? []}
        onPick={(v) => set("nulTelevote", Array.isArray(v) ? v : null)}
        allowNone
        mode="multi"
      />
      <CountryDrawer
        title={t(lang, "bet_big5")}
        sub={t(lang, "bet_big5_sub")}
        open={drawerKey === "highestBig5"}
        onClose={() => setDrawerKey(null)}
        selected={bets.highestBig5 ? [bets.highestBig5] : []}
        onPick={(v) =>
          set("highestBig5", typeof v === "string" ? v : null)
        }
        options={BIG_5 as readonly string[]}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------

// Cleaner row frame: drop the loud horizontal gradient + heavy
// glass-card stack in favour of a quiet bg-white/[0.03] tile with a
// hairline ring that lights up on hover. The "+N" max badge moves
// inline with the label as a small flamingo chip; sub text under it.
function RowFrame({
  children,
  onOpen,
  asButton,
}: {
  children: React.ReactNode;
  onOpen?: () => void;
  asButton: boolean;
}) {
  const className =
    "w-full text-left rounded-2xl px-4 py-3.5 flex items-center gap-3 " +
    "bg-white/[0.04] ring-1 ring-white/8 transition";
  if (asButton) {
    return (
      <motion.button
        type="button"
        onClick={onOpen}
        whileTap={{ scale: 0.99 }}
        className={
          className +
          " hover:bg-white/[0.07] hover:ring-white/20 active:bg-white/[0.05]"
        }
      >
        {children}
      </motion.button>
    );
  }
  return <div className={className}>{children}</div>;
}

function HeaderText({
  label,
  sub,
  max,
}: {
  label: string;
  sub: string;
  max?: number;
}) {
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <p className="font-display text-[15px] truncate">{label}</p>
        {max != null && (
          <span className="shrink-0 text-[10px] font-display tabular-nums tracking-wider
                           px-1.5 py-0.5 rounded-full
                           bg-flamingo/15 text-flamingo ring-1 ring-flamingo/30">
            +{max}
          </span>
        )}
      </div>
      <p className="text-xs text-white/50 leading-snug mt-0.5">{sub}</p>
    </div>
  );
}

function CountryRow({
  label,
  sub,
  max,
  value,
  onOpen,
}: {
  label: string;
  sub: string;
  max?: number;
  value: string | null;
  onOpen: () => void;
}) {
  const lang = useLang();
  const c = value && value !== NONE_TOKEN ? getCountry(value) : null;
  return (
    <RowFrame asButton onOpen={onOpen}>
      <HeaderText label={label} sub={sub} max={max} />
      <div className="flex items-center gap-1.5 shrink-0">
        {c ? (
          <HeartFlag code={c.code} name={countryName(c.code, lang)} size="sm" />
        ) : value === NONE_TOKEN ? (
          <span className="text-xs font-display text-white/80 px-3 py-1 rounded-full bg-white/10">
            {t(lang, "no_country")}
          </span>
        ) : (
          <span className="text-xs text-white/35 italic">{t(lang, "tap_to_pick")}</span>
        )}
        <ChevronRight className="h-4 w-4 text-dark-blue-300" />
      </div>
    </RowFrame>
  );
}

function MultiCountryRow({
  label,
  sub,
  value,
  onOpen,
}: {
  label: string;
  sub: string;
  value: string[];
  onOpen: () => void;
}) {
  const lang = useLang();
  const picks = value.filter(Boolean);
  return (
    <RowFrame asButton onOpen={onOpen}>
      <HeaderText label={label} sub={sub} max={12} />
      <div className="flex items-center gap-2 shrink-0">
        {picks.length === 0 ? (
          <span className="text-xs text-white/40 italic">{t(lang, "tap_to_pick")}</span>
        ) : (
          <span className="flex items-center -space-x-1.5 max-w-[6rem]">
            {picks.slice(0, 4).map((code) =>
              code === NONE_TOKEN ? (
                <span
                  key={code}
                  className="h-5 w-7 grid place-items-center rounded-[3px] bg-white/15 text-[10px] uppercase tracking-widest text-white/70"
                >
                  —
                </span>
              ) : (
                <Flag key={code} code={code} size="sm" />
              ),
            )}
            {picks.length > 4 && (
              <span className="ml-2 text-xs text-white/60 tabular-nums">
                +{picks.length - 4}
              </span>
            )}
          </span>
        )}
        <ChevronRight className="h-4 w-4 text-dark-blue-300" />
      </div>
    </RowFrame>
  );
}

function YesNoRow({
  label,
  sub,
  max,
  value,
  onChange,
  lang,
}: {
  label: string;
  sub: string;
  max?: number;
  value: boolean | null;
  onChange: (v: boolean | null) => void;
  lang: "en" | "lt";
}) {
  return (
    <RowFrame asButton={false}>
      <HeaderText label={label} sub={sub} max={max} />
      <div className="flex items-center gap-0.5 rounded-full bg-black/40 p-1 shrink-0 text-xs ring-1 ring-white/8">
        {(["yes", "no", "skip"] as const).map((opt) => {
          const active =
            (opt === "yes" && value === true) ||
            (opt === "no" && value === false) ||
            (opt === "skip" && value === null);
          const optLabel =
            opt === "yes" ? t(lang, "yes_short")
              : opt === "no" ? t(lang, "no_short")
                : t(lang, "skip_short");
          return (
            <button
              key={opt}
              type="button"
              onClick={() =>
                onChange(opt === "yes" ? true : opt === "no" ? false : null)
              }
              className={`px-3 py-1 rounded-full font-display transition ${
                active
                  ? "bg-white text-dark-blue"
                  : "text-white/55 hover:text-white"
              }`}
            >
              {optLabel}
            </button>
          );
        })}
      </div>
    </RowFrame>
  );
}

function NumberRow({
  label,
  sub,
  max,
  value,
  onChange,
}: {
  label: string;
  sub: string;
  max?: number;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <RowFrame asButton={false}>
      <HeaderText label={label} sub={sub} max={max} />
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={1000}
        value={value ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "") {
            onChange(null);
            return;
          }
          const n = Number(v);
          if (!Number.isFinite(n)) return;
          onChange(Math.max(0, Math.min(1000, Math.round(n))));
        }}
        placeholder="?"
        className="h-11 w-16 shrink-0 rounded-xl border border-white/15 bg-black/30
                   text-center font-display text-xl tabular-nums text-white caret-flamingo
                   focus:border-flamingo focus:outline-none focus:ring-2 focus:ring-flamingo/40 transition"
      />
    </RowFrame>
  );
}
