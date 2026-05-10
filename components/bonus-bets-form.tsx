"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { ChevronRight } from "lucide-react";
import { Flag } from "@/components/flag";
import { CountryDrawer } from "@/components/country-drawer";
import { countries, getCountry } from "@/lib/countries";
import { BIG_5, HOST_COUNTRY, type Bets } from "@/lib/scoring";
import { useLang, t, fmt } from "@/lib/i18n";

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
  const host = getCountry(HOST_COUNTRY);
  const lang = useLang();
  const homeName = home?.name ?? "Home";
  const hostName = host?.name ?? "Host";

  // Track which row's drawer is open via a discriminated key.
  const [drawerKey, setDrawerKey] = useState<keyof Bets | null>(null);

  const set = <K extends keyof Bets>(k: K, v: Bets[K]) =>
    onChange({ ...bets, [k]: v });

  return (
    <div className="flex flex-col gap-3">
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

      <CountryRow
        label={t(lang, "bet_big5")}
        sub={t(lang, "bet_big5_sub")}
        max={3}
        value={bets.highestBig5 ?? null}
        onOpen={() => setDrawerKey("highestBig5")}
      />

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

      <MultiCountryRow
        label={t(lang, "bet_nul")}
        sub={t(lang, "bet_nul_sub")}
        value={bets.nulTelevote ?? []}
        onOpen={() => setDrawerKey("nulTelevote")}
      />

      {home && (
        <NumberRow
          label={fmt(t(lang, "bet_lt_total"), { home: homeName })}
          sub={fmt(t(lang, "bet_lt_total_sub"), { home: homeName })}
          max={10}
          value={bets.ltTotalPoints ?? null}
          onChange={(v) => set("ltTotalPoints", v)}
        />
      )}

      <YesNoRow
        label={t(lang, "bet_same_winner")}
        sub={t(lang, "bet_same_winner_sub")}
        max={2}
        value={bets.sameWinners ?? null}
        onChange={(v) => set("sameWinners", v)}
        lang={lang}
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

      {/* Drawers: only one mounted at a time. */}
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
          title={`12 from ${home.name} to`}
          sub={`Pick the country you think ${home.name} will award 12 points to. Exact +5.`}
          open={drawerKey === "lt12To"}
          onClose={() => setDrawerKey(null)}
          selected={bets.lt12To ? [bets.lt12To] : []}
          onPick={(v) => set("lt12To", typeof v === "string" ? v : null)}
        />
      )}
      <CountryDrawer
        title="Highest-placed Big 5"
        sub="Of UK, Germany, France, Italy, Spain — which finishes best? +3."
        open={drawerKey === "highestBig5"}
        onClose={() => setDrawerKey(null)}
        selected={bets.highestBig5 ? [bets.highestBig5] : []}
        onPick={(v) =>
          set("highestBig5", typeof v === "string" ? v : null)
        }
        options={BIG_5 as readonly string[]}
      />
      <CountryDrawer
        title="Jury winner"
        sub="Country that wins the jury vote. Exact +5."
        open={drawerKey === "juryWinner"}
        onClose={() => setDrawerKey(null)}
        selected={bets.juryWinner ? [bets.juryWinner] : []}
        onPick={(v) =>
          set("juryWinner", typeof v === "string" ? v : null)
        }
      />
      <CountryDrawer
        title="Televote winner"
        sub="Country that wins the public televote. Exact +5."
        open={drawerKey === "televoteWinner"}
        onClose={() => setDrawerKey(null)}
        selected={bets.televoteWinner ? [bets.televoteWinner] : []}
        onPick={(v) =>
          set("televoteWinner", typeof v === "string" ? v : null)
        }
      />
      <CountryDrawer
        title="Nul points (televote)"
        sub="Pick any number of countries you think get zero from the public. Add 'No country' if you think nobody does. +4 per correct, max +12."
        open={drawerKey === "nulTelevote"}
        onClose={() => setDrawerKey(null)}
        selected={bets.nulTelevote ?? []}
        onPick={(v) => set("nulTelevote", Array.isArray(v) ? v : null)}
        allowNone
        mode="multi"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------

function RowFrame({
  children,
  onOpen,
  asButton,
}: {
  children: React.ReactNode;
  onOpen?: () => void;
  asButton: boolean;
}) {
  const className = `w-full text-left list-entry-gradient glass-card ${
    asButton ? "list-card-hover" : ""
  } rounded-xl p-3 flex items-center gap-3`;
  if (asButton) {
    return (
      <motion.button
        type="button"
        onClick={onOpen}
        whileTap={{ scale: 0.985 }}
        className={className}
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
  // No useLang here: this lives inside a button so re-using parent's
  // lang would be cleaner, but the "max +N" label is so short and
  // numeric that the same string works in both languages.
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        <p className="font-display">{label}</p>
        {max != null && (
          <span className="text-[10px] uppercase tracking-widest text-flamingo">
            +{max}
          </span>
        )}
      </div>
      <p className="text-xs text-white/55 leading-relaxed">{sub}</p>
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
  const c = value && value !== NONE_TOKEN ? getCountry(value) : null;
  return (
    <RowFrame asButton onOpen={onOpen}>
      <HeaderText label={label} sub={sub} max={max} />
      <div className="flex items-center gap-2 shrink-0">
        {c ? (
          <span className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-flamingo/20 border border-flamingo/40">
            <Flag code={c.code} size="sm" />
            <span className="text-sm font-display max-w-[7rem] truncate">
              {c.name}
            </span>
          </span>
        ) : value === NONE_TOKEN ? (
          <span className="text-sm text-white/70 px-2.5 py-1 rounded-full bg-white/10">
            No country
          </span>
        ) : (
          <span className="text-xs text-white/40 italic">tap to pick</span>
        )}
        <ChevronRight className="h-4 w-4 text-white/30" />
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
  const picks = value.filter(Boolean);
  return (
    <RowFrame asButton onOpen={onOpen}>
      <HeaderText label={label} sub={sub} max={12} />
      <div className="flex items-center gap-2 shrink-0">
        {picks.length === 0 ? (
          <span className="text-xs text-white/40 italic">tap to pick</span>
        ) : (
          <span className="flex items-center -space-x-1.5 max-w-[6rem]">
            {picks.slice(0, 4).map((code) =>
              code === NONE_TOKEN ? (
                <span
                  key={code}
                  className="h-5 w-7 grid place-items-center rounded-[3px] bg-white/15 text-[10px] uppercase tracking-widest text-white/70 border border-dark-blue-900"
                >
                  —
                </span>
              ) : (
                <Flag
                  key={code}
                  code={code}
                  size="sm"
                  className="ring-2 ring-dark-blue-900"
                />
              ),
            )}
            {picks.length > 4 && (
              <span className="ml-2 text-xs text-white/60 tabular-nums">
                +{picks.length - 4}
              </span>
            )}
          </span>
        )}
        <ChevronRight className="h-4 w-4 text-white/30" />
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
      <div className="flex items-center gap-1 rounded-full bg-black/30 p-1 shrink-0 text-xs">
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
              className={`px-3 py-1 rounded-full transition ${
                active
                  ? "bg-flamingo text-white shadow-glow-pink"
                  : "text-white/60 hover:text-white"
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
        className="h-12 w-20 shrink-0 rounded-md border border-white/15 bg-black/30
                   text-center font-display text-2xl tabular-nums text-white
                   caret-flamingo focus:border-flamingo focus:outline-none
                   focus:ring-2 focus:ring-flamingo/40 transition"
      />
    </RowFrame>
  );
}

// Suppress unused warning if a future bet drops countries dependency.
void countries;
