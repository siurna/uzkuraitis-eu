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

type FluentEntry = { folder: string; slug: string };

const FLUENT_EMOJI: Record<string, FluentEntry> = {
  // Drunk-poll choices.
  "🥛": { folder: "Glass of milk", slug: "glass_of_milk" },
  "🍺": { folder: "Beer mug", slug: "beer_mug" },
  "🍷": { folder: "Wine glass", slug: "wine_glass" },
  "🥃": { folder: "Tumbler glass", slug: "tumbler_glass" },

  // Quick reactions strip (chat-row long-press menu).
  "❤️": { folder: "Red heart", slug: "red_heart" },
  "😂": {
    folder: "Face with tears of joy",
    slug: "face_with_tears_of_joy",
  },
  "🤯": { folder: "Exploding head", slug: "exploding_head" },
  "🙌": { folder: "Raising hands", slug: "raising_hands" },
  "😱": {
    folder: "Face screaming in fear",
    slug: "face_screaming_in_fear",
  },
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

  // Welcome banner / housekeeping.
  "👋": { folder: "Waving hand", slug: "waving_hand" },

  // Selfie polaroid prompt.
  "📸": { folder: "Camera with flash", slug: "camera_with_flash" },

  // Reaction confetti + extras used in surfaces that aren't the
  // long-press menu (highlights / profile / seed data / home).
  "⭐": { folder: "Star", slug: "star" },
  "🎉": { folder: "Party popper", slug: "party_popper" },
  "🔥": { folder: "Fire", slug: "fire" },
  "👏": { folder: "Clapping hands", slug: "clapping_hands" },
  "😭": { folder: "Loudly crying face", slug: "loudly_crying_face" },

  // Bingo trope leading-emojis. ~70 glyphs across the deck.
  // Country-flag tropes (🇮🇱 🇬🇧 🇮🇹 …) deliberately stay native:
  // Microsoft's flag set is 2D and would clash with the 3D style.
  "⏸️":  { folder: "Pause button", slug: "pause_button" },
  "☝️":  { folder: "Index pointing up", slug: "index_pointing_up" },
  "⚡":   { folder: "High voltage", slug: "high_voltage" },
  "✋":   { folder: "Raised hand", slug: "raised_hand" },
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
  "💃":  { folder: "Woman dancing", slug: "woman_dancing" },
  "💇":  { folder: "Person getting haircut", slug: "person_getting_haircut" },
  "💍":  { folder: "Ring", slug: "ring" },
  "💒":  { folder: "Wedding", slug: "wedding" },
  "💥":  { folder: "Collision", slug: "collision" },
  "💧":  { folder: "Droplet", slug: "droplet" },
  "💪":  { folder: "Flexed biceps", slug: "flexed_biceps" },
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
  "🚶":  { folder: "Person walking", slug: "person_walking" },
  "🛏️":  { folder: "Bed", slug: "bed" },
  "🛸":  { folder: "Flying saucer", slug: "flying_saucer" },
  "🛼":  { folder: "Roller skate", slug: "roller_skate" },
  "🟦":  { folder: "Blue square", slug: "blue_square" },
  "🤝":  { folder: "Handshake", slug: "handshake" },
  "🤸":  { folder: "Person cartwheeling", slug: "person_cartwheeling" },
  "🥱":  { folder: "Yawning face", slug: "yawning_face" },
  "🥶":  { folder: "Cold face", slug: "cold_face" },
  "🦋":  { folder: "Butterfly", slug: "butterfly" },
  "🦵":  { folder: "Leg", slug: "leg" },
  "🧊":  { folder: "Ice", slug: "ice" },
  "🧎":  { folder: "Person kneeling", slug: "person_kneeling" },
  "🧗":  { folder: "Person climbing", slug: "person_climbing" },
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
};

export function fluentEmojiUrl(glyph: string): string | null {
  const entry = FLUENT_EMOJI[glyph];
  if (!entry) return null;
  return `${CDN_BASE}/${encodeURIComponent(entry.folder)}/3D/${entry.slug}_3d.png`;
}

export function hasFluentEmoji(glyph: string): boolean {
  return glyph in FLUENT_EMOJI;
}
