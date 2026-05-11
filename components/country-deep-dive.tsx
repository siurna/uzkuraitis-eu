"use client";

import { useState, useMemo, createContext, useContext } from "react";
import { Mic, Music } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { HeartFlag } from "@/components/flag";
import { getCountry, countryName } from "@/lib/countries";
import { participantPhoto } from "@/lib/participants";
import { useLang, t } from "@/lib/i18n";

// Country deep-dive sheet — opens on a country code, shows the chip,
// artist, song, running order, plus a one-tap shortcut to search the
// performance on YouTube. Reuses the BottomSheet primitive so it stacks
// over chat / settings / wherever.
//
// Exposed via <CountryDeepDiveProvider> context: any descendant can call
// useCountryDeepDive().open(code) — keeps the sheet mounted once at
// layout level instead of dozens of clickable chips each owning their
// own state.

type Ctx = {
  open: (code: string) => void;
  close: () => void;
};

const Context = createContext<Ctx | null>(null);

export function useCountryDeepDive(): Ctx {
  const ctx = useContext(Context);
  if (!ctx) return { open: () => {}, close: () => {} };
  return ctx;
}

export function CountryDeepDiveProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [code, setCode] = useState<string | null>(null);
  const value = useMemo<Ctx>(
    () => ({ open: (c) => setCode(c), close: () => setCode(null) }),
    [],
  );
  return (
    <Context.Provider value={value}>
      {children}
      <CountryDeepDiveSheet
        code={code}
        onClose={() => setCode(null)}
      />
    </Context.Provider>
  );
}

function CountryDeepDiveSheet({
  code,
  onClose,
}: {
  code: string | null;
  onClose: () => void;
}) {
  const lang = useLang();
  const country = code ? getCountry(code) : null;

  // YouTube search URL — opens in a new tab. We don't deep-link to a
  return (
    <BottomSheet
      open={!!country}
      onClose={onClose}
      title={country ? countryName(country.code, lang) : ""}
    >
      {country && (
        <div className="flex flex-col gap-4 pb-2">
          {/* Hero photo — fades in only when the press-kit shot is
              available on disk. Falls back gracefully to the chip
              header alone if the participant photo is missing. */}
          {participantPhoto(country.code) && (
            <div className="relative -mx-1 rounded-2xl overflow-hidden aspect-[16/9] bg-white/[0.04]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={participantPhoto(country.code) as string}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-dark-blue-900/85 via-dark-blue-900/10 to-transparent" />
              <div className="absolute bottom-3 left-3 right-3 flex items-center gap-3">
                <HeartFlag code={country.code} size="md" />
                <p className="font-display text-lg drop-shadow-[0_2px_6px_rgba(0,0,0,0.7)] truncate">
                  {countryName(country.code, lang)}
                </p>
              </div>
            </div>
          )}
          {!participantPhoto(country.code) && (
            <div className="flex items-center gap-3">
              <HeartFlag code={country.code} size="lg" />
              <div className="flex-1 min-w-0">
                <p className="font-display text-lg truncate">{country.name}</p>
              </div>
            </div>
          )}
          <p className="text-xs text-white/55">
            #{country.order} {t(lang, "deep_order")}
          </p>

          {country.artist && (
            <Row icon={<Mic className="h-4 w-4 text-white/70" />}
                 label={t(lang, "deep_artist")}
                 value={country.artist} />
          )}
          {country.song && (
            <Row icon={<Music className="h-4 w-4 text-white/70" />}
                 label={t(lang, "deep_song")}
                 value={country.song}
                 italic />
          )}
        </div>
      )}
    </BottomSheet>
  );
}

function Row({
  icon,
  label,
  value,
  italic,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  italic?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl px-4 py-3
                    bg-white/[0.04] ring-1 ring-white/8">
      <span className="shrink-0 mt-0.5">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-[0.2em] text-white/45 font-display mb-0.5">
          {label}
        </p>
        <p
          className={`text-sm text-white/90 truncate ${
            italic ? "italic" : ""
          }`}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

// Convenience wrapper: a button that opens the deep-dive sheet for a
// given country code. Used to wrap heart-flag chips in tappable rows
// without sprinkling onClick everywhere.
export function CountryTrigger({
  code,
  children,
  className,
}: {
  code: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { open } = useCountryDeepDive();
  return (
    <button
      type="button"
      onClick={() => open(code)}
      className={className}
      aria-label={`Country info for ${code.toUpperCase()}`}
    >
      {children}
    </button>
  );
}

