// Microsoft Fluent Emoji 3D — a hand-curated subset of glyphs the
// app uses on its featured surfaces (poll choices, broadcast cards,
// reactions strip, top-3 medals). Native chat emojis are deliberately
// out of scope: anything a viewer types in chat still renders with
// the OS's native emoji set.
//
// Asset source: https://github.com/microsoft/fluentui-emoji (Apache
// 2.0). We fetch the 3D variant straight from jsdelivr so we don't
// have to vendor the PNGs (~250 KB per glyph). The folder name +
// file slug pattern in the repo is consistent, so each entry just
// needs `folder` (URL-encoded human-readable name) + `slug`
// (snake_case filename stem). The `_3d.png` suffix is added below.

const CDN_BASE =
  "https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets";

// Microsoft Fluent ships TWO file-layout patterns:
//
//  - Plain emoji (face, object, food, animal): /<Folder>/3D/<slug>_3d.png
//  - Body-part / person emoji (hand, dancer, climber, etc): these have
//    skin-tone variants, so the default file lives at
//    /<Folder>/Default/3D/<slug>_3d_default.png
//
// The repo doesn't ship the plain path for skin-tone-enabled emojis at
// all — requesting it 403s. Entries opt into the skin-tone layout by
// setting `skin: true`. Everything else uses the plain path.
//
// `url` is an escape hatch: when set, `fluentEmojiUrl` returns it
// verbatim and skips the folder+slug builder. Used for glyphs that
// Microsoft DOESN'T ship in Fluent 3D (country flags by policy) but
// we still want to render as a brand-aligned 3D image. Today: the
// Lithuanian flag, hand-rendered to match Fluent's style + parked
// on our Supabase bucket. NEVER use this to add other country flags
// to bingo — see CLAUDE.md's bingo-emoji rule. The LT override only
// exists for non-bingo surfaces (presence bar idle eyebrow, home
// bet-chips marquee, settings preview, etc).
type FluentEntry = {
  folder?: string;
  slug?: string;
  skin?: boolean;
  url?: string;
};

const FLUENT_EMOJI: Record<string, FluentEntry> = {
  // Drunk-poll choices.
  "🥛": { folder: "Glass of milk", slug: "glass_of_milk" },
  "🍺": { folder: "Beer mug", slug: "beer_mug" },
  "🍷": { folder: "Wine glass", slug: "wine_glass" },
  "🥃": { folder: "Tumbler glass", slug: "tumbler_glass" },

  // Quick reactions strip (chat-row long-press menu).
  "❤️": { folder: "Red heart", slug: "red_heart" },
  "😂": { folder: "Face with tears of joy", slug: "face_with_tears_of_joy" },
  "🤯": { folder: "Exploding head", slug: "exploding_head" },
  "🙌": { folder: "Raising hands", slug: "raising_hands", skin: true },
  "😱": { folder: "Face screaming in fear", slug: "face_screaming_in_fear" },
  "💀": { folder: "Skull", slug: "skull" },

  // Medals — used by the top-3 broadcast card + leaderboard chip.
  "🥇": { folder: "1st place medal", slug: "1st_place_medal" },
  "🥈": { folder: "2nd place medal", slug: "2nd_place_medal" },
  "🥉": { folder: "3rd place medal", slug: "3rd_place_medal" },

  // Bonus-bets chips on the broadcast card.
  "🏆": { folder: "Trophy", slug: "trophy" },
  "🎤": { folder: "Microphone", slug: "microphone" },
  "🎯": { folder: "Bullseye", slug: "bullseye" },
  "🥄": { folder: "Spoon", slug: "spoon" },
  "🎺": { folder: "Trumpet", slug: "trumpet" },
  "🎙️": { folder: "Studio microphone", slug: "studio_microphone" },
  "🎲": { folder: "Game die", slug: "game_die" },
  "💎": { folder: "Gem stone", slug: "gem_stone" },
  "🌟": { folder: "Glowing star", slug: "glowing_star" },
  "🎼": { folder: "Musical score", slug: "musical_score" },
  "🍿": { folder: "Popcorn", slug: "popcorn" },
  "✨": { folder: "Sparkles", slug: "sparkles" },
  "📺": { folder: "Television", slug: "television" },
  "🔮": { folder: "Crystal ball", slug: "crystal_ball" },

  // Welcome banner / housekeeping. Skin-tone variants live under
  // /Default/ — the plain /3D/ path 403s.
  "👋": { folder: "Waving hand", slug: "waving_hand", skin: true },

  // Selfie polaroid prompt.
  "📸": { folder: "Camera with flash", slug: "camera_with_flash" },

  // Reaction confetti + extras used in surfaces that aren't the
  // long-press menu (highlights / profile / seed data / home).
  "⭐": { folder: "Star", slug: "star" },
  "🎉": { folder: "Party popper", slug: "party_popper" },
  "🔥": { folder: "Fire", slug: "fire" },
  "👏": { folder: "Clapping hands", slug: "clapping_hands", skin: true },
  "😭": { folder: "Loudly crying face", slug: "loudly_crying_face" },

  // You-vs-the-room widget artwork (empty-state placeholder).
  "📊": { folder: "Bar chart", slug: "bar_chart" },

  // Bingo trope leading-emojis. ~70 glyphs across the deck.
  // Country-flag tropes (🇮🇱 🇬🇧 🇮🇹 …) deliberately stay native:
  // Microsoft's flag set is 2D and would clash with the 3D style.
  "⏸️":  { folder: "Pause button", slug: "pause_button" },
  "☝️":  { folder: "Index pointing up", slug: "index_pointing_up", skin: true },
  "⚡":   { folder: "High voltage", slug: "high_voltage" },
  "✋":   { folder: "Raised hand", slug: "raised_hand", skin: true },
  "🌍":  { folder: "Globe showing europe-africa", slug: "globe_showing_europe-africa" },
  "🌑":  { folder: "New moon", slug: "new_moon" },
  "🌙":  { folder: "Crescent moon", slug: "crescent_moon" },
  "🌧️":  { folder: "Cloud with rain", slug: "cloud_with_rain" },
  "🌫️":  { folder: "Fog", slug: "fog" },
  "🍋":  { folder: "Lemon", slug: "lemon" },
  "🍾":  { folder: "Bottle with popping cork", slug: "bottle_with_popping_cork" },
  "🎆":  { folder: "Fireworks", slug: "fireworks" },
  "🎬":  { folder: "Clapper board", slug: "clapper_board" },
  "🎭":  { folder: "Performing arts", slug: "performing_arts" },
  "🎶":  { folder: "Musical notes", slug: "musical_notes" },
  "🎸":  { folder: "Guitar", slug: "guitar" },
  "🎹":  { folder: "Musical keyboard", slug: "musical_keyboard" },
  "🎻":  { folder: "Violin", slug: "violin" },
  "🏳️‍🌈": { folder: "Rainbow flag", slug: "rainbow_flag" },
  "🏳️":  { folder: "White flag", slug: "white_flag" },
  "🐺":  { folder: "Wolf", slug: "wolf" },
  "🐾":  { folder: "Paw prints", slug: "paw_prints" },
  "👗":  { folder: "Dress", slug: "dress" },
  "👯":  { folder: "People with bunny ears", slug: "people_with_bunny_ears" },
  "💃":  { folder: "Woman dancing", slug: "woman_dancing", skin: true },
  "💇":  { folder: "Person getting haircut", slug: "person_getting_haircut", skin: true },
  "💍":  { folder: "Ring", slug: "ring" },
  "💒":  { folder: "Wedding", slug: "wedding" },
  "💥":  { folder: "Collision", slug: "collision" },
  "💧":  { folder: "Droplet", slug: "droplet" },
  "💪":  { folder: "Flexed biceps", slug: "flexed_biceps", skin: true },
  "💻":  { folder: "Laptop", slug: "laptop" },
  "📞":  { folder: "Telephone receiver", slug: "telephone_receiver" },
  "📦":  { folder: "Package", slug: "package" },
  "🔁":  { folder: "Repeat button", slug: "repeat_button" },
  "🔦":  { folder: "Flashlight", slug: "flashlight" },
  "🕊️":  { folder: "Dove", slug: "dove" },
  "🖤":  { folder: "Black heart", slug: "black_heart" },
  "🗣️":  { folder: "Speaking head", slug: "speaking_head" },
  "😬":  { folder: "Grimacing face", slug: "grimacing_face" },
  "🚁":  { folder: "Helicopter", slug: "helicopter" },
  "🚶":  { folder: "Person walking", slug: "person_walking", skin: true },
  "🛏️":  { folder: "Bed", slug: "bed" },
  "🛸":  { folder: "Flying saucer", slug: "flying_saucer" },
  "🛼":  { folder: "Roller skate", slug: "roller_skate" },
  "🟦":  { folder: "Blue square", slug: "blue_square" },
  "🤝":  { folder: "Handshake", slug: "handshake", skin: true },
  "🤸":  { folder: "Person cartwheeling", slug: "person_cartwheeling", skin: true },
  "🥱":  { folder: "Yawning face", slug: "yawning_face" },
  "🥶":  { folder: "Cold face", slug: "cold_face" },
  "🦋":  { folder: "Butterfly", slug: "butterfly" },
  "🦵":  { folder: "Leg", slug: "leg", skin: true },
  "🧊":  { folder: "Ice", slug: "ice" },
  "🧎":  { folder: "Person kneeling", slug: "person_kneeling", skin: true },
  "🧗":  { folder: "Person climbing", slug: "person_climbing", skin: true },
  "🩰":  { folder: "Ballet shoes", slug: "ballet_shoes" },
  "🪂":  { folder: "Parachute", slug: "parachute" },
  "🪜":  { folder: "Ladder", slug: "ladder" },
  "🪞":  { folder: "Mirror", slug: "mirror" },
  "🪗":  { folder: "Accordion", slug: "accordion" },
  "🪦":  { folder: "Headstone", slug: "headstone" },
  "🪩":  { folder: "Mirror ball", slug: "mirror_ball" },
  "🫀":  { folder: "Anatomical heart", slug: "anatomical_heart" },

  // Notification onboarding step.
  "🔔":  { folder: "Bell", slug: "bell" },
  "🔕":  { folder: "Bell with slash", slug: "bell_with_slash" },

  // Bingo trope leads that the manifest was missing.
  "🪑":  { folder: "Chair", slug: "chair" },
  "0️⃣":  { folder: "Keycap 0", slug: "keycap_0" },
  "🎷":  { folder: "Saxophone", slug: "saxophone" },
  "📮":  { folder: "Postbox", slug: "postbox" },
  "🤐":  { folder: "Zipper-mouth face", slug: "zipper-mouth_face" },
  "📋":  { folder: "Clipboard", slug: "clipboard" },
  "🚪":  { folder: "Door", slug: "door" },
  "🕳️":  { folder: "Hole", slug: "hole" },
  "🤳":  { folder: "Selfie", slug: "selfie", skin: true },
  "🥁":  { folder: "Drum", slug: "drum" },
  "🛗":  { folder: "Elevator", slug: "elevator" },

  // Toast icon set (`components/app-toaster.tsx`). MS Fluent ships
  // "Red exclamation mark" (not "Exclamation mark") so the slug
  // mirrors that. Warning / light bulb take their plain folder name.
  "❗":  { folder: "Red exclamation mark", slug: "red_exclamation_mark" },
  "⚠️":  { folder: "Warning", slug: "warning" },
  "💡":  { folder: "Light bulb", slug: "light_bulb" },

  // System-message leads from lib/i18n.ts (sys_voting_open / closed,
  // sys_show_started / ended, sys_voted, sys_cta_vote). They render
  // inline inside chat rows — wrap them in <FluentEmoji> at the
  // chat-system-row renderer to lift them to 3D too.
  "📣":  { folder: "Megaphone", slug: "megaphone" },
  "🔒":  { folder: "Locked", slug: "locked" },
  "🟢":  { folder: "Green circle", slug: "green_circle" },
  "🏁":  { folder: "Chequered flag", slug: "chequered_flag" },
  "🗳️":  { folder: "Ballot box with ballot", slug: "ballot_box_with_ballot" },

  // Lithuanian flag — the one country flag we render in 3D. MS
  // Fluent doesn't ship country flags, so this PNG is hand-rendered
  // in the Fluent style and parked on our Supabase bucket. Used on
  // surfaces where LT IS the brand (presence bar idle eyebrow, home
  // bet-chips marquee, etc) — NOT on bingo. See CLAUDE.md.
  "🇱🇹":  {
    url: "https://mbgkujipbdfsdvjobtrf.supabase.co/storage/v1/object/public/icons/lt-flag-fluent.png",
  },
};

// Country-flag emojis are encoded as a pair of regional-indicator
// code points (🇱🇹 = U+1F1F1 + U+1F1F9 → "LT"). Microsoft Fluent
// deliberately doesn't ship country flags ("Country flags are not
// included in the project" — geopolitical concerns, Taiwan/PRC,
// etc), so the FluentEmoji renderer leans on Twemoji's flat-color
// flag PNGs instead. Twemoji's 72x72 set sits visually closer to
// Fluent's flat-color 2D variants than either the project's
// rectangular `<Flag>` SVG or the OS-native emoji glyphs (which
// vary wildly per platform). Twemoji is MIT/CC-BY licensed and
// served via jsdelivr.
const REGIONAL_INDICATOR_BASE = 0x1f1e6; // 🇦
const REGIONAL_INDICATOR_LAST = 0x1f1ff; // 🇿
export function flagIsoFromGlyph(glyph: string): string | null {
  const cps = Array.from(glyph).map((c) => c.codePointAt(0) ?? 0);
  if (cps.length !== 2) return null;
  if (
    cps[0] < REGIONAL_INDICATOR_BASE ||
    cps[0] > REGIONAL_INDICATOR_LAST ||
    cps[1] < REGIONAL_INDICATOR_BASE ||
    cps[1] > REGIONAL_INDICATOR_LAST
  ) {
    return null;
  }
  const a = String.fromCharCode(0x41 + (cps[0] - REGIONAL_INDICATOR_BASE));
  const b = String.fromCharCode(0x41 + (cps[1] - REGIONAL_INDICATOR_BASE));
  return (a + b).toLowerCase();
}

// CDN URL for Twemoji's 72x72 country flag PNG matching a regional-
// indicator emoji pair. Returns null when the glyph isn't a flag.
export function twemojiFlagUrl(glyph: string): string | null {
  const cps = Array.from(glyph).map((c) => c.codePointAt(0) ?? 0);
  if (cps.length !== 2) return null;
  if (
    cps[0] < REGIONAL_INDICATOR_BASE ||
    cps[0] > REGIONAL_INDICATOR_LAST ||
    cps[1] < REGIONAL_INDICATOR_BASE ||
    cps[1] > REGIONAL_INDICATOR_LAST
  ) {
    return null;
  }
  const hex = cps.map((cp) => cp.toString(16)).join("-");
  return `https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/72x72/${hex}.png`;
}

export function fluentEmojiUrl(glyph: string): string | null {
  const entry = FLUENT_EMOJI[glyph];
  if (!entry) return null;
  if (entry.url) return entry.url;
  if (!entry.folder || !entry.slug) return null;
  const folder = encodeURIComponent(entry.folder);
  return entry.skin
    ? `${CDN_BASE}/${folder}/Default/3D/${entry.slug}_3d_default.png`
    : `${CDN_BASE}/${folder}/3D/${entry.slug}_3d.png`;
}

export function hasFluentEmoji(glyph: string): boolean {
  return glyph in FLUENT_EMOJI;
}
