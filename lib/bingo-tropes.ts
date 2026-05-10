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
// more than two Eurovisions. Mix camp glamour, key changes, political
// jokes, staging gimmicks, and host-banter moments.

export const TROPES_EN = [
  "🎤 Wind machine moment",
  "🔥 Pyro on the chorus",
  "👯 Backing dancers in matching mesh",
  "🎹 Key change",
  "💃 Floor-spin reveal",
  "👗 Costume rip-off",
  "🪞 Mirror choreography",
  "💧 Fake tears, real eyeliner",
  "🎻 Folk instrument cameo",
  "🦅 Animal on stage (real or fake)",
  "🏳️‍🌈 Rainbow flag in the crowd",
  "🌑 Lights cut to silhouette",
  "💋 Hostage kiss at the end",
  "🇪🇺 Performer in two languages",
  "🎯 A staring contest with the camera",
  "🪩 Disco ball drops",
  "🩰 Acrobatic lift",
  "⚡ Strobe seizure warning",
  "🥁 Drumline mid-song",
  "🦢 Floaty white dress + fan",
  "👑 A literal crown on someone",
  "🦂 Stage prop bigger than the artist",
  "🎬 Camera angle from below the stage",
  "💪 Inexplicable shirtless dancer",
  "🎺 Saxophone solo",
  "🪦 Power ballad about a dead relative",
  "🐎 Eastern European hop dance",
  "🇸🇪 Nordic banger that sounds like 2014",
  "🎸 Guitar solo on a non-guitar song",
  "🔮 Witchy chants intro",
  "🌌 Galaxy projection on the floor",
  "🎭 Backstory in the postcard",
  "📞 Phone-vote plug from the host",
  "😬 Host's bad pun in three languages",
  "🤝 Awkward host handshake",
  "🇮🇸 Iceland sends a fashion crime",
  "🇮🇱 Israel sends a sleeper hit",
  "🇮🇹 Italy treats Eurovision as Sanremo",
  "🇬🇧 UK gets booed (a little)",
  "🇫🇷 France goes full chanson",
  "🇪🇸 Spain ends in falsetto",
  "🇩🇪 Germany commits to a bit",
  "🎂 Someone in the green room cries",
  "🛸 UFO / sci-fi staging",
  "🐺 Howl, growl, or roar on cue",
  "💎 Visible glitter for hours after",
  "🚂 12 points from Greece to Cyprus",
  "🇱🇹 Lithuania scores higher than expected",
  "📺 The hosts switch outfits at every break",
  "🥇 Bookies' favourite tanks in the televote",
] as const;

export const TROPES_LT = [
  "🎤 Vėjo mašinos akimirka",
  "🔥 Pirotechnika ant priedainio",
  "👯 Šokėjai su vienodu tinkliuku",
  "🎹 Tono pakėlimas",
  "💃 Sukamasi ant grindų",
  "👗 Kostiumo nuplėšimas",
  "🪞 Veidrodinė choreografija",
  "💧 Netikros ašaros, tikras lainerinis",
  "🎻 Folko instrumento epizodas",
  "🦅 Gyvūnas scenoje (tikras ar netikras)",
  "🏳️‍🌈 Vaivorykštinė vėliava minioje",
  "🌑 Šviesos iškerta į siluetą",
  "💋 Bučinys pabaigoje",
  "🇪🇺 Atlikėjas dainuoja dviem kalbom",
  "🎯 Žvilgsnio dvikova su kamera",
  "🪩 Diskobalas nukrenta",
  "🩰 Akrobatinis kėlimas",
  "⚡ Strobas (kepenis tausok)",
  "🥁 Būgnininkų linija viduryje",
  "🦢 Plonytė balta suknelė + ventiliatorius",
  "👑 Tikra karūna ant galvos",
  "🦂 Scenografija didesnė už atlikėją",
  "🎬 Kameros kampas iš apačios",
  "💪 Šokėjas be marškinių (be aiškios priežasties)",
  "🎺 Saksofono solo",
  "🪦 Galinga baladė apie mirusį giminaitį",
  "🐎 Rytų europietiškas šokis su pašokimu",
  "🇸🇪 Šiaurės šalių hitas, skambantis kaip 2014",
  "🎸 Gitaros solo dainoj be gitaros",
  "🔮 Raganos giesmė intro",
  "🌌 Galaktikos projekcija ant grindų",
  "🎭 Pasakojimas pristatyme",
  "📞 Vedantis primena, kad reikia balsuoti",
  "😬 Vedančio prastas pokštas trimis kalbom",
  "🤝 Nepatogus vedančiojo paspaudimas",
  "🇮🇸 Islandija atvelka madą-nusikaltimą",
  "🇮🇱 Izraelis atveža slaptą hitą",
  "🇮🇹 Italija žaidžia Sanremo",
  "🇬🇧 JK pakauliama (švelniai)",
  "🇫🇷 Prancūzija eina į pilną chanson",
  "🇪🇸 Ispanija užbaigia falsetu",
  "🇩🇪 Vokietija įsivelia į keistą koncepciją",
  "🎂 Kažkas užkulisiuose verkia",
  "🛸 NSO / sci-fi scenografija",
  "🐺 Staugimas, urzgimas ar riaumojimas vietoje",
  "💎 Blizgučių valandoms",
  "🚂 12 taškų iš Graikijos Kiprui",
  "🇱🇹 Lietuva surenka daugiau nei tikėtasi",
  "📺 Vedantys keičia drabužius kas pertrauką",
  "🥇 Bukmekerių favoritas suklumpa žiūrovų balse",
] as const;

export type TropeIndex = number;

export function getTrope(i: TropeIndex, lang: "en" | "lt"): string {
  const list = lang === "lt" ? TROPES_LT : TROPES_EN;
  return list[i] ?? "";
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
