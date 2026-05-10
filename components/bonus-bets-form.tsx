"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { ChevronRight } from "lucide-react";
import { Flag } from "@/components/flag";
import { CountryDrawer } from "@/components/country-drawer";
import { countries, getCountry } from "@/lib/countries";
import { BIG_5, HOST_COUNTRY, type Bets } from "@/lib/scoring";

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

  // Track which row's drawer is open via a discriminated key.
  const [drawerKey, setDrawerKey] = useState<keyof Bets | null>(null);

  const set = <K extends keyof Bets>(k: K, v: Bets[K]) =>
    onChange({ ...bets, [k]: v });

  return (
    <div className="flex flex-col gap-3">
      <CountryRow
        label="Wooden spoon"
        sub="Who finishes last? Exact +5, off-by-1 +2."
        max={5}
        value={bets.woodenSpoon ?? null}
        onOpen={() => setDrawerKey("woodenSpoon")}
      />

      {home && (
        <CountryRow
          label={`12 from ${home.name} to`}
          sub={`Where does ${home.name} give its 12 points? Exact +5.`}
          max={5}
          value={bets.lt12To ?? null}
          onOpen={() => setDrawerKey("lt12To")}
        />
      )}

      <CountryRow
        label="Highest-placed Big 5"
        sub="UK, Germany, France, Italy, or Spain — which finishes best? +3."
        max={3}
        value={bets.highestBig5 ?? null}
        onOpen={() => setDrawerKey("highestBig5")}
      />

      <CountryRow
        label="Jury winner"
        sub="The country that wins the jury vote. Exact +5."
        max={5}
        value={bets.juryWinner ?? null}
        onOpen={() => setDrawerKey("juryWinner")}
      />

      <CountryRow
        label="Televote winner"
        sub="The country that wins the public televote. Exact +5."
        max={5}
        value={bets.televoteWinner ?? null}
        onOpen={() => setDrawerKey("televoteWinner")}
      />

      <MultiCountryRow
        label="Nul points (televote)"
        sub="Pick any countries you think get zero from the public, or 'No country' if you think nobody scores zero. +4 per correct guess, capped at +12."
        value={bets.nulTelevote ?? []}
        onOpen={() => setDrawerKey("nulTelevote")}
      />

      <YesNoRow
        label="Same winner?"
        sub="Does the same country win both jury and televote? Y/N +2."
        max={2}
        value={bets.sameWinners ?? null}
        onChange={(v) => set("sameWinners", v)}
      />

      <YesNoRow
        label={`${host?.name ?? "Host"} top 3?`}
        sub={`Will the host country (${host?.name ?? "AT"}) finish in the top 3? Y/N +3.`}
        max={3}
        value={bets.hostTop3 ?? null}
        onChange={(v) => set("hostTop3", v)}
      />

      <YesNoRow
        label="Solo winner?"
        sub="Will the winner be a solo act (vs duo / group)? Y/N +2."
        max={2}
        value={bets.winnerSolo ?? null}
        onChange={(v) => set("winnerSolo", v)}
      />

      {/* Drawers: only one mounted at a time. */}
      <CountryDrawer
        title="Wooden spoon"
        sub="Pick the country you think will finish last. Exact +5, off-by-1 +2."
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
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        <p className="font-display">{label}</p>
        {max != null && (
          <span className="text-[10px] uppercase tracking-widest text-flamingo">
            max +{max}
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
}: {
  label: string;
  sub: string;
  max?: number;
  value: boolean | null;
  onChange: (v: boolean | null) => void;
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
              {opt === "skip" ? "—" : opt}
            </button>
          );
        })}
      </div>
    </RowFrame>
  );
}

// Suppress unused warning if a future bet drops countries dependency.
void countries;
