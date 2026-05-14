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
};

export function fluentEmojiUrl(glyph: string): string | null {
  const entry = FLUENT_EMOJI[glyph];
  if (!entry) return null;
  return `${CDN_BASE}/${encodeURIComponent(entry.folder)}/3D/${entry.slug}_3d.png`;
}

export function hasFluentEmoji(glyph: string): boolean {
  return glyph in FLUENT_EMOJI;
}
