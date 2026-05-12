"use client";

import { useState, useMemo, createContext, useContext } from "react";
import { Mic, Music, Instagram, Youtube, Globe, Disc3, Music4 } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Flag } from "@/components/flag";
import { getCountry, countryName } from "@/lib/countries";
import { participantPhoto } from "@/lib/participants";
import { optimizedSrc } from "@/lib/img";
import { artistSocials, type ArtistSocials } from "@/lib/socials";
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

  return (
    <BottomSheet
      open={!!country}
      onClose={onClose}
      title={
        country ? (
          <span className="flex items-center gap-2.5">
            <Flag code={country.code} size="md" />
            <span className="min-w-0 truncate">{countryName(country.code, lang)}</span>
          </span>
        ) : (
          ""
        )
      }
    >
      {country && (
        <div className="flex flex-col gap-4 pb-2">
          {/* Hero photo — fades in only when the press-kit shot is on
              disk; otherwise the flag-led title is enough. */}
          {participantPhoto(country.code) && (
            <div className="relative -mx-1 rounded-2xl overflow-hidden aspect-[16/9] bg-white/[0.04]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={optimizedSrc(participantPhoto(country.code) as string, 1200)}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-dark-blue-900/45 to-transparent" />
            </div>
          )}

          {country.artist && (
            <Row icon={<Mic className="h-4 w-4 text-dark-blue-200" />}
                 label={t(lang, "deep_artist")}
                 value={country.artist} />
          )}
          {country.song && (
            <Row icon={<Music className="h-4 w-4 text-dark-blue-200" />}
                 label={t(lang, "deep_song")}
                 value={country.song}
                 italic />
          )}

          <SocialLinks code={country.code} artist={country.artist} song={country.song} />
        </div>
      )}
    </BottomSheet>
  );
}

const SOCIAL_META: { key: keyof ArtistSocials; icon: React.ReactNode; label: string }[] = [
  { key: "instagram", icon: <Instagram className="h-4 w-4" />, label: "Instagram" },
  { key: "spotify", icon: <Disc3 className="h-4 w-4" />, label: "Spotify" },
  { key: "youtube", icon: <Youtube className="h-4 w-4" />, label: "YouTube" },
  { key: "tiktok", icon: <Music4 className="h-4 w-4" />, label: "TikTok" },
  { key: "website", icon: <Globe className="h-4 w-4" />, label: "Website" },
];

function SocialLinks({
  code,
  artist,
  song,
}: {
  code: string;
  artist?: string;
  song?: string;
}) {
  const socials = artistSocials(code, artist, song);
  const items = SOCIAL_META.filter((m) => socials[m.key]);
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 pt-1">
      {items.map((m) => (
        <a
          key={m.key}
          href={socials[m.key]}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-full px-3.5 py-2 text-sm
                     bg-white/[0.06] ring-1 ring-white/12 hover:bg-white/[0.1]
                     text-white/85 transition"
        >
          <span className="text-white/70">{m.icon}</span>
          {m.label}
        </a>
      ))}
    </div>
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

