// Eurovision 2026 — Vienna lineup.
//
// Sources (last cross-referenced 2026-05-09):
//   - https://www.eurovision.com/eurovision-song-contest/vienna-2026/all-participants/
//   - https://eurovisionworld.com/eurovision/2026
//
// Artist/song names were collected from web search aggregators
// because the official site is JS-rendered. The `code` (ISO 3166-1
// alpha-2 lowercase) and `flag` emoji are authoritative — those
// drive scoring tables, SVG lookup, and Fluent emoji rendering.

import type { Country } from "@/lib/countries";
import type { Season } from "./types";

const countries: Country[] = [
  { code: "dk", name: "Denmark",        flag: "🇩🇰", artist: "Søren Torpegaard Lund",                 song: "Før Vi Går Hjem",      order: 1  },
  { code: "de", name: "Germany",        flag: "🇩🇪", artist: "Sarah Engels",                          song: "Fire",                 order: 2  },
  { code: "il", name: "Israel",         flag: "🇮🇱", artist: "Noam Bettan",                           song: "Michelle",             order: 3  },
  { code: "be", name: "Belgium",        flag: "🇧🇪", artist: "ESSYLA",                                song: "Dancing on the Ice",   order: 4  },
  { code: "al", name: "Albania",        flag: "🇦🇱", artist: "Alis",                                  song: "Nân",                  order: 5  },
  { code: "gr", name: "Greece",         flag: "🇬🇷", artist: "Akylas",                                song: "Ferto",                order: 6  },
  { code: "ua", name: "Ukraine",        flag: "🇺🇦", artist: "LELÉKA",                                song: "Ridnym",               order: 7  },
  { code: "au", name: "Australia",      flag: "🇦🇺", artist: "Delta Goodrem",                         song: "Eclipse",              order: 8  },
  { code: "rs", name: "Serbia",         flag: "🇷🇸", artist: "LAVINA",                                song: "Kraj Mene",            order: 9  },
  { code: "mt", name: "Malta",          flag: "🇲🇹", artist: "AIDAN",                                 song: "Bella",                order: 10 },
  { code: "cz", name: "Czechia",        flag: "🇨🇿", artist: "Daniel Zizka",                          song: "CROSSROADS",           order: 11 },
  { code: "bg", name: "Bulgaria",       flag: "🇧🇬", artist: "DARA",                                  song: "Bangaranga",           order: 12 },
  { code: "hr", name: "Croatia",        flag: "🇭🇷", artist: "LELEK",                                 song: "Andromeda",            order: 13 },
  { code: "gb", name: "United Kingdom", flag: "🇬🇧", artist: "LOOK MUM NO COMPUTER",                  song: "Eins, Zwei, Drei",    order: 14 },
  { code: "fr", name: "France",         flag: "🇫🇷", artist: "Monroe",                                song: "Regarde !",            order: 15 },
  { code: "md", name: "Moldova",        flag: "🇲🇩", artist: "Satoshi",                               song: "Viva, Moldova!",       order: 16 },
  { code: "fi", name: "Finland",        flag: "🇫🇮", artist: "Linda Lampenius x Pete Parkkonen",      song: "Liekinheitin",         order: 17 },
  { code: "pl", name: "Poland",         flag: "🇵🇱", artist: "ALICJA",                                song: "Pray",                 order: 18 },
  { code: "lt", name: "Lithuania",      flag: "🇱🇹", artist: "Lion Ceccah",                           song: "Sólo Quiero Más",      order: 19 },
  { code: "se", name: "Sweden",         flag: "🇸🇪", artist: "FELICIA",                               song: "My System",            order: 20 },
  { code: "cy", name: "Cyprus",         flag: "🇨🇾", artist: "Antigoni",                              song: "JALLA",                order: 21 },
  { code: "it", name: "Italy",          flag: "🇮🇹", artist: "Sal Da Vinci",                          song: "Per Sempre Sì",        order: 22 },
  { code: "no", name: "Norway",         flag: "🇳🇴", artist: "JONAS LOVV",                            song: "YA YA YA",             order: 23 },
  { code: "ro", name: "Romania",        flag: "🇷🇴", artist: "Alexandra Căpitănescu",                 song: "Choke Me",             order: 24 },
  { code: "at", name: "Austria",        flag: "🇦🇹", artist: "COSMÓ",                                 song: "Tanzschein",           order: 25 },
];

export const SEASON_2026: Season = {
  year: 2026,
  hostCountry: "at",
  hostCity: { en: "Vienna", lt: "Viena" },
  countries,
  // 2026 cycle: Spain withdrew, so the historical "Big 5" auto-
  // qualifiers list shrinks to four. The closeness ladder + side-bet
  // picker operate on whoever actually competes.
  big5: ["gb", "de", "fr", "it"],
  theme: {
    // Near-black navy. Matches the bottom of the bloom so the iOS PWA
    // keyboard slide reads as the page extending into the keyboard
    // chrome instead of cutting against a brighter brand colour.
    pageBg: "#0c1428",
    bloom: {
      // Muted rose entering from the upper-right.
      warm: "58% 0.18 350 / 0.30",
      // Deep amethyst from the upper-left.
      cool: "42% 0.18 295 / 0.32",
    },
    themeColor: "#0c1428",
  },
};
