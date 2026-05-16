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
  "🎷 A saxophone solo nobody saw coming",
  "🪞 Mirror floor reflects the singer twice",
  "🖤 Romania's leather corset of doom",
  "⚡ Choke Me electric tubes on the floor",
  "🎭 Lion Ceccah's hooded cloak reveal (LT)",
  "💃 Lithuania sings in Spanish for some reason",
  "🌫️ Albania does dry ice + stars (again)",
  "🎻 Ukrainian bandura + billowing fabric",
  "🩰 France brings full musical-theatre energy",
  "🎯 Felicia 'fights the lasers' (SE)",
  "📦 Denmark's color-shifting box prop",
  "🎬 Malta's zootrope spins on cue",

  // — country running jokes for 2026. Leading emoji is always a
  //   literal noun / object, never a country flag — see CLAUDE.md
  //   "Bingo emoji rule" for why. Text body still names the country.
  "📣 Israel gets booed audibly",
  "🥶 UK finishes bottom five (again)",
  "🎭 Italy treats this as Sanremo: The Sequel",
  "🎶 France goes full chanson + a key change",
  "🟦 Germany commits hard to a weird concept",
  "🪩 Sweden sends another Melodifestivalen banger",
  "🤝 Greece and Cyprus trade 12 points like a love letter",
  "🎲 Lithuania scores higher than the bookies said",
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

  // — more timeless, universal clichés —
  "🪜 Singer descends a grand staircase",
  "🎆 Confetti cannons on the final note",
  "🦋 Surprise costume reveal mid-song",
  "🤸 A backing dancer does a backflip",
  "🔦 One spotlight → blackout → full stage",
  "🧎 Dramatic kneel at the climax",
  "☝️ Singer points dead at the camera",
  "🗣️ An unprompted spoken-word bit",
  "🎬 Fake ending, then one more chorus",
  "👯 Backing dancers in identical catsuits",
  "🌧️ It starts 'raining' on stage",
  "🚁 A sweeping drone shot of the arena",
  "🫀 Singer clutches their chest, eyes shut",
  "🔁 Last 20s: key change AND a held high note",
  "💍 Lyrics: love conquers literally everything",
  "🍾 Lyrics: we party till the sun comes up",
  "🕊️ A 'world peace' line shoehorned in",
  "🌍 'Thank you Europe' in five languages",
  "🪩 An obligatory disco ball",
  "📺 The LED wall = the singer's face, 10 m tall",
  "🐺 Someone performs in an animal mask",
  "🪂 Acrobats / aerial silks descend",
  "🛼 Roller skates, for no reason at all",
  "✋ The crowd claps along — slightly off-beat",
  "💇 A perfectly synchronised hair flip",
  "🚶 Slow-motion walk toward the camera",
  "⏸️ A dramatic pause before the beat drops",
  "🛏️ Singer lies flat on stage at the bridge",
  "🎸 A genuinely fun guitar solo",
  "🦵 The 'one knee, hand outstretched' pose",
  "🎶 The 'na na na' / 'la la la' hook",
  "✨ Full camp: sequins, capes, the works",
  "😬 Host banter eats 90 awkward seconds",
  "🎤 A mic 'drop' that's very gently set down",
  "🤝 A surprise duet or guest",
  "🥶 Cryo fog up to the singer's knees",
  "🪞 Two mirrored singers — 'wait, are they twins?'",
  "🛸 A weirdly sci-fi staging concept",
  "🧊 The stage floor lights up like a dance pad",
  "🥱 A whole song about partying all night, zero sleep",
  "📮 Postcard plays like a tourism ad",
  "🤐 Lip-sync visibly slips on a high note",
  "📋 Audience holds a hand-made lyric sign",
  "🚪 A stagehand briefly wanders into shot",
  "🕳️ The song fades to black, then silence",
  "🤳 A jury spokesperson goes off-script",
  "👏 Loud boos greet a low jury score",
  "🥁 A drummer joins for one chorus only",
  "🎻 A famous classical piece gets sampled",
  "🛗 Singer rises through a hatch in the stage",
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
  "🎷 Netikėtas saksofono solo",
  "🪞 Veidrodinė scena atspindi atlikėją dvigubai",
  "🖤 Rumunijos odinis korsetas",
  "⚡ „Choke Me“ elektros vamzdžiai ant grindų",
  "🎭 Lion Ceccah gobtuvinis apsiaustas (LT)",
  "💃 Lietuva neaiškiai dainuoja ispaniškai",
  "🌫️ Albanija vėl traukia sausą ledą ir žvaigždes",
  "🎻 Ukrainietiška bandūra plius plevenanti drobė",
  "🩰 Prancūzija įjungia miuziklo režimą",
  "🎯 Felicia „kaunasi su lazeriais“ (SE)",
  "📦 Danijos spalvas keičianti dėžė",
  "🎬 Maltos zootropas pradeda suktis",

  // — kasmetiniai juokai apie šalis. Vedantis emoji visada daiktas
  //   ar simbolis, niekada vėliava (žr. CLAUDE.md). Tekstas vis dar
  //   gali įvardyti šalį.
  "📣 Izraelis garsiai nušvilpiamas",
  "🥶 JK vėl penketuke iš apačios",
  "🎭 Italija laiko tai Sanremo tęsiniu",
  "🎶 Prancūzija eina į pilną chanson + tono pakėlimas",
  "🟦 Vokietija įsivelia į keistą koncepciją",
  "🪩 Švedija atveža dar vieną Melodifestivalen hitą",
  "🤝 Graikija ir Kipras vėl keičiasi 12 taškų kaip meilės laiškais",
  "🎲 Lietuva surenka daugiau nei žadėjo bukmekeriai",
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

  // — daugiau amžinų, universalių klišių —
  "🪜 Atlikėjas leidžiasi nuo didingų laiptų",
  "🎆 Konfeti patrankos ant paskutinės natos",
  "🦋 Netikėtas kostiumo atskleidimas viduryje dainos",
  "🤸 Šokėjas atlieka salto",
  "🔦 Vienas prožektorius → tamsa → visa scena",
  "🧎 Dramatiškas atsiklaupimas kulminacijoje",
  "☝️ Atlikėjas rodo tiesiai į kamerą",
  "🗣️ Niekieno neprašyta kalbamoji dalis",
  "🎬 Netikra pabaiga, paskui dar vienas priedainis",
  "👯 Šokėjai vienodais kombinezonais",
  "🌧️ Scenoje pradeda „lyti“",
  "🚁 Platus dronu nufilmuotas arenos kadras",
  "🫀 Atlikėjas spaudžia ranką prie krūtinės, akys užmerktos",
  "🔁 Paskutinės 20 s: tono pakėlimas IR ilga aukšta nata",
  "💍 Tekstas: meilė nugali absoliučiai viską",
  "🍾 Tekstas: vakarėliaujam iki saulėtekio",
  "🕊️ Įgrūsta eilutė apie „pasaulio taiką“",
  "🌍 „Ačiū, Europa“ penkiomis kalbomis",
  "🪩 Privalomas diskobalas",
  "📺 LED siena = atlikėjo veidas, 10 m aukščio",
  "🐺 Kažkas pasirodo su gyvūno kauke",
  "🪂 Nusileidžia akrobatai ar oro audeklai",
  "🛼 Riedučiai, visiškai be priežasties",
  "✋ Minia ploja kartu — truputį ne į taktą",
  "💇 Tobulai sinchronizuotas plaukų metimas",
  "🚶 Sulėtintas ėjimas link kameros",
  "⏸️ Dramatiška pauzė prieš ritmo kritimą",
  "🛏️ Atlikėjas atsigula ant scenos per bridžą",
  "🎸 Tikrai linksmas gitaros solo",
  "🦵 Poza „ant vieno kelio, ranka ištiesta“",
  "🎶 „Na na na“ / „la la la“ kabliukas",
  "✨ Pilnas kempas: blizgučiai, apsiaustai, viskas",
  "😬 Vedančių pliurpalas suvalgo 90 nejaukių sekundžių",
  "🎤 Mikrofono „numetimas“, kuris labai švelniai padedamas",
  "🤝 Netikėtas duetas ar svečias",
  "🥶 Krio rūkas iki atlikėjo kelių",
  "🪞 Du veidrodiškai sutampantys atlikėjai — „ar jie dvyniai?“",
  "🛸 Keistai mokslinės fantastikos scenografija",
  "🧊 Scenos grindys šviečia kaip šokių aikštelė",
  "🥱 Visa daina apie naktinį vakarėlį be miego",
  "📮 Atvirukas atrodo kaip turizmo reklama",
  "🤐 Per aukštą natą akivaizdžiai prasprūsta fonograma",
  "📋 Žiūrovas iškelia ranka rašytą teksto plakatą",
  "🚪 Į kadrą įklysta scenos darbuotojas",
  "🕳️ Daina užgesta į tamsą ir tylą",
  "🤳 Šalies žiuri atstovas pradeda improvizuoti",
  "👏 Salė nušvilpia žemą žiuri įvertinimą",
  "🥁 Būgnininkas pasirodo tik vienam priedainiui",
  "🎻 Dainoje pasiskolinta klasikos melodija",
  "🛗 Atlikėjas iškyla pro angą scenos viduryje",
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
