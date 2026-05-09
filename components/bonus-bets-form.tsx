"use client";

import { Flag } from "@/components/flag";
import { countries, getCountry } from "@/lib/countries";
import { BIG_5, HOST_COUNTRY, NONE_TOKEN, type Bets } from "@/lib/scoring";

// All side-bet inputs in one stack. Same `bets` state shape as the API
// expects; the parent owns it and persists it to localStorage.
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
  const set = <K extends keyof Bets>(k: K, v: Bets[K]) =>
    onChange({ ...bets, [k]: v });

  return (
    <div className="flex flex-col gap-3">
      <CountryPick
        label="Wooden spoon"
        sub="Who finishes last? Exact +5, off-by-1 +2."
        value={bets.woodenSpoon ?? ""}
        onChange={(v) => set("woodenSpoon", v || null)}
        max={5}
      />

      {home && (
        <CountryPick
          label={`12 from ${home.name} to`}
          sub="Where does Lithuania give its 12 points? Exact +5."
          value={bets.lt12To ?? ""}
          onChange={(v) => set("lt12To", v || null)}
          max={5}
        />
      )}

      <CountryPick
        label="Highest-placed Big 5"
        sub="UK, DE, FR, IT, or ES — which finishes best? +3."
        value={bets.highestBig5 ?? ""}
        onChange={(v) => set("highestBig5", v || null)}
        options={BIG_5 as readonly string[]}
        max={3}
      />

      <CountryPick
        label="Jury winner"
        sub="The country that wins the jury vote. Exact +5."
        value={bets.juryWinner ?? ""}
        onChange={(v) => set("juryWinner", v || null)}
        max={5}
      />

      <CountryPick
        label="Televote winner"
        sub="The country that wins the televote. Exact +5."
        value={bets.televoteWinner ?? ""}
        onChange={(v) => set("televoteWinner", v || null)}
        max={5}
      />

      <CountryPick
        label="Nul points (televote)"
        sub="Which country gets zero from the public? Exact +8. Pick 'No country' if you think nobody scores zero."
        value={bets.nulTelevote ?? ""}
        onChange={(v) => set("nulTelevote", v || null)}
        extraOption={{ value: NONE_TOKEN, label: "No country" }}
        max={8}
      />

      <YesNoPick
        label="Same winner?"
        sub="Does the same country win both jury and televote? Y/N +2."
        value={bets.sameWinners ?? null}
        onChange={(v) => set("sameWinners", v)}
        max={2}
      />

      {home && (
        <>
          <YesNoPick
            label={`${home.name} top 10?`}
            sub={`Will ${home.name} finish in the top 10? Y/N +3.`}
            value={bets.ltTop10 ?? null}
            onChange={(v) => set("ltTop10", v)}
            max={3}
          />
          <YesNoPick
            label={`${home.name} top 5?`}
            sub={`Top 5 only counts if ${home.name} actually places top 5. Y/N +5.`}
            value={bets.ltTop5 ?? null}
            onChange={(v) => set("ltTop5", v)}
            max={5}
          />
        </>
      )}

      <YesNoPick
        label={`${host?.name ?? "Host"} top 3?`}
        sub={`Will the host country (${host?.name ?? "AT"}) place top 3? Y/N +3.`}
        value={bets.hostTop3 ?? null}
        onChange={(v) => set("hostTop3", v)}
        max={3}
      />

      <YesNoPick
        label="Solo winner?"
        sub="Will the winner be a solo act (vs duo/group)? Y/N +2."
        value={bets.winnerSolo ?? null}
        onChange={(v) => set("winnerSolo", v)}
        max={2}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------

function CountryPick({
  label,
  sub,
  value,
  onChange,
  options,
  extraOption,
  max,
}: {
  label: string;
  sub: string;
  value: string;
  onChange: (v: string) => void;
  options?: readonly string[];
  extraOption?: { value: string; label: string };
  max?: number;
}) {
  const list = options ?? countries.map((c) => c.code);
  return (
    <div className="list-entry-gradient glass-card rounded-xl p-3 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-display truncate">{label}</p>
          {max != null && (
            <span className="text-[10px] uppercase tracking-widest text-flamingo">
              max +{max}
            </span>
          )}
        </div>
        <p className="text-xs text-white/55 truncate">{sub}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {value && value !== NONE_TOKEN && getCountry(value) && (
          <Flag code={value} size="sm" />
        )}
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 rounded-md border border-white/15 bg-black/30 px-2 text-sm max-w-[10rem]"
        >
          <option value="">— skip —</option>
          {extraOption && (
            <option value={extraOption.value}>{extraOption.label}</option>
          )}
          {list.map((code) => {
            const c = getCountry(code);
            return (
              <option key={code} value={code}>
                {c?.name ?? code.toUpperCase()}
              </option>
            );
          })}
        </select>
      </div>
    </div>
  );
}

function YesNoPick({
  label,
  sub,
  value,
  onChange,
  max,
}: {
  label: string;
  sub: string;
  value: boolean | null;
  onChange: (v: boolean | null) => void;
  max?: number;
}) {
  return (
    <div className="list-entry-gradient glass-card rounded-xl p-3 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-display truncate">{label}</p>
          {max != null && (
            <span className="text-[10px] uppercase tracking-widest text-flamingo">
              max +{max}
            </span>
          )}
        </div>
        <p className="text-xs text-white/55 truncate">{sub}</p>
      </div>
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
    </div>
  );
}
