// Eurovision bingo tropes. Pure data — no DB needed. The bingo card
// reads this list, picks 24 deterministically from the voter's session
// id (PRNG seed) + leaves the middle FREE square, renders the 5×5, and
// broadcasts each strike as a reaction so the rest of the room sees it.
//
// Two parallel lists keyed by index so {EN, LT} stay in lockstep. Add
// new tropes by appending to BOTH arrays — never reorder; the index is
// the stable id stored in localStorage.
//
// Tone: cliché-as-fuck, instantly recognisable to anyone who's watched
// more than two Eurovisions. Tuned for Vienna 2026 (the Wiener
// Stadthalle final on 16 May 2026) — mixes timeless ESC tropes with
// rehearsal-confirmed 2026 staging gimmicks, country running jokes,
// and host/interval moments.

export const TROPES_EN = [
  // — timeless cliches that always hit —
  "🎤 Wind machine moment",
  "🔥 Pyro on the chorus",
  "🎹 Key change",
  "👗 Costume rip-off mid-song",
  "💧 Fake tears, real eyeliner",
  "🎻 Folk instrument cameo",
  "🏳️‍🌈 Rainbow flag in the crowd",
  "🌑 Lights cut to silhouette",
  "🪞 Mirror-twin choreography",
  "💪 Inexplicable shirtless dancer",

  // — Vienna 2026 staging confirmed in rehearsals —
  "🔥 Finland sets the violin on fire (basically)",
  "🪑 Burning confessional + flying chairs (FI)",
  "💒 Italy stages a literal wedding in four acts",
  "🍋 Lemon trees + fairy lights for Sal Da Vinci",
  "🌙 Delta Goodrem's moon-to-sun pyro reveal",
  "💎 500-hour Swarovski gown (AU, allegedly)",
  "🪑 Antigoni's giant dinner table of dancers",
  "💻 UK guy with monitor-headed office workers",
  "🎹 Hand-built synth wall (LOOK MUM NO COMPUTER)",
  "🟦 Sarah Engels lies on a glowing cube",
  "🪩 Cosmó's mirrorball breastplate of armour",
  "🐾 Austria's 'inner animal' dancers slither in",
  "🧗 Climbing frames descend from the ceiling",
  "🎸 Vanilla Ninja are back like it's 2005",
  "💥 Estonia ends on a pyro detonation",
  "🖤 Romania's leather corset of doom",
  "⚡ Choke Me electric tubes on the floor",
  "🎭 Lion Ceccah's hooded cloak reveal (LT)",
  "🇱🇹 Lithuania sings in Spanish for some reason",
  "🌫️ Albania does dry ice + stars (again)",
  "🇺🇦 Ukrainian bandura + billowing fabric",
  "🩰 France brings full musical-theatre energy",
  "🎯 Felicia 'fights the lasers' (SE)",
  "📦 Denmark's color-shifting box prop",
  "🎬 Malta's zootrope spins on cue",

  // — country running jokes for 2026 —
  "🇮🇱 Israel gets booed audibly",
  "🇬🇧 UK finishes bottom five (again)",
  "🇮🇹 Italy treats this as Sanremo: The Sequel",
  "🇫🇷 France goes full chanson + a key change",
  "🇩🇪 Germany commits hard to a weird concept",
  "🇸🇪 Sweden sends another Melodifestivalen banger",
  "🇬🇷 Greece + 🇨🇾 trade 12 points like a love letter",
  "🇱🇹 Lithuania scores higher than the bookies said",
  "🏳️ Someone notices a country has boycotted",
  "🪦 Power ballad about a dead relative",

  // — host / interval / voting moments —
  "💃 Victoria Swarovski changes outfit again",
  "😬 Ostrowski's pun lands in zero languages",
  "🎼 JJ does the Mozart opening with 40 dancers",
  "🪗 Verka Serduchka steals the interval act",
  "🎺 Lordi shows up unprovoked",
  "🎶 Someone sings 'Vienna' before the results",
  "📞 Host begs you to vote one more time",
  "🥇 Finland's odds collapse in the televote",
] as const;

export const TROPES_LT = [
  // — amžinos klišės —
  "🎤 Vėjo mašinos akimirka",
  "🔥 Pirotechnika ant priedainio",
  "🎹 Tono pakėlimas",
  "👗 Kostiumo nuplėšimas viduryje dainos",
  "💧 Netikros ašaros, tikras lainerinis",
  "🎻 Folko instrumento epizodas",
  "🏳️‍🌈 Vaivorykštinė vėliava minioje",
  "🌑 Šviesos nukerta į siluetą",
  "🪞 Veidrodžiu sutampanti choreografija",
  "💪 Šokėjas be marškinių (be aiškios priežasties)",

  // — Vienos 2026 scenografija iš repeticijų —
  "🔥 Suomija padega smuiką (beveik)",
  "🪑 Degantis konfesionalas ir kylančios kėdės (FI)",
  "💒 Italija scenoje rengia tikras vestuves",
  "🍋 Citrinmedžiai ir girliandos Sal Da Vinciui",
  "🌙 Delta Goodrem: mėnulis virsta saule ir pyro",
  "💎 500 valandų Swarovski suknelė (AU, sako)",
  "🪑 Antigoni didžiulis stalas su šokėjais",
  "💻 JK vyrukas su biuro kolegom monitorinėm galvom",
  "🎹 Ranka sukurta sintezatorių siena (UK)",
  "🟦 Sarah Engels guli ant šviečiančio kubo",
  "🪩 Cosmó šarvai iš diskobalo",
  "🐾 Austrijos „vidiniai gyvūnai“ ropoja scena",
  "🧗 Iš lubų leidžiasi laipiojimo karkasai",
  "🎸 Vanilla Ninja grįžo lyg 2005-ieji",
  "💥 Estija užbaigia pyro sprogimu",
  "🖤 Rumunijos odinis korsetas",
  "⚡ „Choke Me“ elektros vamzdžiai ant grindų",
  "🎭 Lion Ceccah gobtuvinis apsiaustas (LT)",
  "🇱🇹 Lietuva neaiškiai dainuoja ispaniškai",
  "🌫️ Albanija vėl traukia sausą ledą ir žvaigždes",
  "🇺🇦 Ukrainietiška bandūra plius plevenanti drobė",
  "🩰 Prancūzija įjungia miuziklo režimą",
  "🎯 Felicia „kaunasi su lazeriais“ (SE)",
  "📦 Danijos spalvas keičianti dėžė",
  "🎬 Maltos zootropas pradeda suktis",

  // — kasmetiniai juokai apie šalis —
  "🇮🇱 Izraelis garsiai nušvilpiamas",
  "🇬🇧 JK vėl penketuke iš apačios",
  "🇮🇹 Italija laiko tai Sanremo tęsiniu",
  "🇫🇷 Prancūzija eina į pilną chanson + tono pakėlimas",
  "🇩🇪 Vokietija įsivelia į keistą koncepciją",
  "🇸🇪 Švedija atveža dar vieną Melodifestivalen hitą",
  "🇬🇷 Graikija ir 🇨🇾 vėl keičiasi 12 taškų kaip meilės laiškais",
  "🇱🇹 Lietuva surenka daugiau nei žadėjo bukmekeriai",
  "🏳️ Kažkas pastebi, kad pora šalių boikotuoja",
  "🪦 Galinga baladė apie mirusį giminaitį",

  // — vedantys / pertraukos / balsavimas —
  "💃 Victoria Swarovski vėl perrengia suknelę",
  "😬 Ostrowskio pokštas nesuveikia nei viena kalba",
  "🎼 JJ atidaro Mozartu su 40 šokėjų",
  "🪗 Verka Serduchka pavogia pertraukos pasirodymą",
  "🎺 Niekieno nekviesti pasirodo Lordi",
  "🎶 Kažkas užtraukia „Vienna“ prieš rezultatus",
  "📞 Vedantys dar kartą primena balsuoti",
  "🥇 Suomijos koeficientas griūva žiūrovų balse",
] as const;

export type TropeIndex = number;

export function getTrope(i: TropeIndex, lang: "en" | "lt"): string {
  const list = lang === "lt" ? TROPES_LT : TROPES_EN;
  return list[i] ?? "";
}

// Each trope string is "<emoji> <words…>". Split the leading emoji
// (everything up to the first space) from the readable text.
export function tropeEmoji(i: TropeIndex): string {
  const s = TROPES_EN[i] ?? "🎲";
  const sp = s.indexOf(" ");
  return sp === -1 ? s : s.slice(0, sp);
}

export function tropeText(i: TropeIndex, lang: "en" | "lt"): string {
  const s = getTrope(i, lang);
  const sp = s.indexOf(" ");
  return sp === -1 ? s : s.slice(sp + 1).trim();
}

export const TROPE_COUNT = TROPES_EN.length;

export const FREE_SQUARE = -1; // sentinel for the centre tile

// Mulberry32 — a small fast deterministic PRNG. Same seed → same card.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Hash a session id (any string) into a 32-bit seed. djb2.
function seedFromSession(session: string): number {
  let h = 5381;
  for (let i = 0; i < session.length; i++) {
    h = ((h << 5) + h + session.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

// Pick 24 distinct trope indices for the user's card; the centre
// (index 12 of the 25-cell grid) is the FREE square. Same session +
// same trope list always returns the same card.
export function buildBingoCard(session: string): TropeIndex[] {
  const rand = mulberry32(seedFromSession(session));
  const pool = Array.from({ length: TROPE_COUNT }, (_, i) => i);
  // Fisher-Yates shuffle in place.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const picks = pool.slice(0, 24);
  // Insert the FREE square at the centre (index 12 of the 5x5).
  return [
    ...picks.slice(0, 12),
    FREE_SQUARE,
    ...picks.slice(12),
  ];
}

// Bingo win detection — any complete row, column, or diagonal of
// struck cells (FREE counts as always-struck).
export function isBingo(
  card: TropeIndex[],
  struck: Set<number>,
): boolean {
  const lit = (i: number) =>
    card[i] === FREE_SQUARE || struck.has(card[i]);

  // Rows
  for (let r = 0; r < 5; r++) {
    if ([0, 1, 2, 3, 4].every((c) => lit(r * 5 + c))) return true;
  }
  // Cols
  for (let c = 0; c < 5; c++) {
    if ([0, 1, 2, 3, 4].every((r) => lit(r * 5 + c))) return true;
  }
  // Diagonals
  if ([0, 6, 12, 18, 24].every(lit)) return true;
  if ([4, 8, 12, 16, 20].every(lit)) return true;
  return false;
}
