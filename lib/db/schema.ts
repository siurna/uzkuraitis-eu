import {
  pgTable,
  text,
  varchar,
  timestamp,
  integer,
  boolean,
  primaryKey,
  uuid,
  index,
  uniqueIndex,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import type { PushPrefs } from "@/lib/push-prefs";
export type { PushPrefs } from "@/lib/push-prefs";

// A "room" is one watch-along group. Friends share a room code (e.g. "ABC123")
// and only see each other's votes & reactions.
export const rooms = pgTable(
  "rooms",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: varchar("code", { length: 8 }).notNull().unique(),
    name: varchar("name", { length: 60 }).notNull(),
    votingEnabled: boolean("voting_enabled").notNull().default(true),
    // When false, the leaderboard for this room stays hidden even after
    // results are entered. Lets a watch-along host delay scoring until
    // the show actually ends. Toggled via the magic admin link.
    tallyEnabled: boolean("tally_enabled").notNull().default(false),
    // Whether the global admin's trivia scheduler should drop a
    // trivia card into THIS room. Default on so existing rooms keep
    // receiving them; per-room admin can flip it off if they want a
    // trivia-free night.
    triviaEnabled: boolean("trivia_enabled").notNull().default(true),
    // ISO 3166-1 alpha-2 lowercase. Used to ask voters where they think
    // this country will finish, scored separately from the top-10 ballot.
    homeCountryCode: varchar("home_country_code", { length: 2 })
      .notNull()
      .default("lt"),
    // ISO 3166-1 alpha-2 lowercase of the country currently performing.
    // Admin-set; clients render a top-of-screen strip + spawn a swarm
    // of heart-flag particles whenever this flips. NULL = no country
    // is highlighted right now.
    nowPlayingCode: varchar("now_playing_code", { length: 2 }),
    // Coarse-grained show state for the room. The admin flips this
    // through the room-manage page; voters see different copy in the
    // header + tabs depending on the value. "not_started" → "in_progress"
    // → "break" → "ended" → "not_started" (next semi/final).
    showStatus: varchar("show_status", { length: 16 })
      .notNull()
      .default("not_started"),
    // When false, the live-commentator bot stays quiet in this room even
    // if it's configured globally. Host-toggled from the magic admin link.
    commentatorEnabled: boolean("commentator_enabled").notNull().default(true),
    // 1-based position of the current act in the running order (e.g. 12
    // of 26). Admin-set alongside now-playing; powers the progress bar on
    // the now-playing hero. NULL = unknown / not tracking.
    runningOrderPos: integer("running_order_pos"),
    // Trivia: cap on how many players can answer a single trivia
    // question per (room, country). NULL = unlimited. Used to make
    // trivia feel like a race (first 5 players, etc.) rather than a
    // group exercise. Server enforces in /api/rooms/[code]/trivia.
    triviaMaxAnswerers: integer("trivia_max_answerers"),
    // How many reactions a chat message needs before it counts as a
    // "highlight" (worth bonus points + flagged in the leaderboard's
    // highlights tally). Higher = harder to game in big rooms, lower
    // = quicker wins in small parties. NULL falls back to the global
    // default (5). The leaderboard + profile aggregations honour
    // whichever is set per-room.
    highlightThreshold: integer("highlight_threshold"),
    // Beginner mode is a PER-USER preference (localStorage toggle,
    // same shape as translate mode), not a per-room setting. No
    // column lives on `rooms` for it. The shared `chat_helper_cache`
    // table further down handles durable caching of the explanations.
    // Long random token granting per-room admin rights. Anyone with the
    // token can manage *this* room (rename, toggle voting, edit results,
    // change the join code) without a global passkey. Generated on room
    // creation, included in the share URL given to the host.
    adminToken: text("admin_token").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastActiveAt: timestamp("last_active_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("rooms_code_idx").on(t.code)],
);

// One row per voter per room. (sessionId, roomId) is unique so a single
// browser can re-edit their own ballot but not vote twice in the same room.
export const voters = pgTable(
  "voters",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    sessionId: varchar("session_id", { length: 64 }).notNull(),
    name: varchar("name", { length: 40 }).notNull(),
    // Predicted final placement for this room's home country (e.g. "where
    // will Lithuania finish?"). Range 1..N where N is the number of
    // finalists. Nullable: voters who skip this still cast their ballot.
    homeCountryPrediction: integer("home_country_prediction"),
    // --- Side bets ("bonus predictions"). All optional. ---
    // Country picks (ISO 3166-1 alpha-2 lowercase, or 'NONE' for nul-points).
    betWoodenSpoon: varchar("bet_wooden_spoon", { length: 4 }),
    betLt12To: varchar("bet_lt_12_to", { length: 4 }),
    betHighestBig5: varchar("bet_highest_big5", { length: 4 }),
    betJuryWinner: varchar("bet_jury_winner", { length: 4 }),
    betTelevoteWinner: varchar("bet_televote_winner", { length: 4 }),
    // Nul-points televote: voter can pick MULTIPLE country guesses, plus
    // an optional "NONE" sentinel for "no country gets zero". Stored as a
    // Postgres text[] array.
    betNulTelevote: text("bet_nul_televote").array(),
    // Yes/no flags.
    betHostTop3: boolean("bet_host_top3"),
    betWinnerSolo: boolean("bet_winner_solo"),
    // Total points the home country (LT by default) will end up with.
    // Scored on closeness, not exact match (shape: exact +10, off-by-5
    // +7, off-by-15 +5, off-by-30 +3, beyond +0). Optional bet.
    betLtTotalPoints: integer("bet_lt_total_points"),
    // Count of voting countries that gave the home country ANY jury
    // points (the "long voting part" — easy to count live during the
    // jury reveal). Scored on closeness: exact +5, ±1 +3, ±3 +2,
    // ±5 +1, beyond 0. Optional bet.
    betLtJuryCount: integer("bet_lt_jury_count"),
    // Presence-as-REST fields. These used to ride on Supabase Realtime
    // presence (channel.track payload) which capped at ~1 update/sec
    // per client and got us kicked off the channel during busy moments.
    // Now the room shell POSTs to /api/rooms/[code]/heartbeat every
    // 60s with the current snapshot and WhosHere polls
    // /api/rooms/[code]/participants every 20s. Nullable: an empty
    // presence is just "they were in the room at some point".
    avatarId: varchar("avatar_id", { length: 40 }),
    vibe: integer("vibe").default(0),
    seenAt: timestamp("seen_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("voters_room_idx").on(t.roomId),
    uniqueIndex("voters_room_session_unique").on(t.roomId, t.sessionId),
  ],
);

// Ten rows per voter (12, 10, 8..1). Composite PK prevents duplicate point
// allocations within the same ballot.
export const votes = pgTable(
  "votes",
  {
    voterId: uuid("voter_id")
      .notNull()
      .references(() => voters.id, { onDelete: "cascade" }),
    points: integer("points").notNull(),
    countryCode: varchar("country_code", { length: 2 }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.voterId, t.points] }),
    index("votes_country_idx").on(t.countryCode),
  ],
);

// Persistent reaction tally per (room, country, emoji). Liveblocks broadcasts
// the live floats; this table is the durable counter for "this country got 47
// hearts during the show".
export const reactions = pgTable(
  "reactions",
  {
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    countryCode: varchar("country_code", { length: 2 }).notNull(),
    emoji: text("emoji").notNull(),
    count: integer("count").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.roomId, t.countryCode, t.emoji] })],
);

// Per-room key/value store for room-scoped settings (e.g. votingEnabled is a
// column above; this is for arbitrary admin toggles like showAdminButton).
export const roomSettings = pgTable(
  "room_settings",
  {
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    value: text("value").notNull(),
  },
  (t) => [primaryKey({ columns: [t.roomId, t.key] })],
);

// The official Eurovision result, entered by an admin once the show is
// over. One row per finalist, placement is 1..N. Global because the show
// only happens once; rooms reference this same table to score their voters.
export const officialResults = pgTable("official_results", {
  countryCode: varchar("country_code", { length: 2 }).primaryKey(),
  placement: integer("placement").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Live commentator: one editable line per country, plus the bot's name
// + photo stored under the reserved keys '__name__' / '__photo__'. When
// a country goes on stage, the bot posts that country's line to chat.
// Global to the installation (one commentator). See `commentatorKeys`.
export const commentator = pgTable("commentator", {
  countryCode: text("country_code").primaryKey(),
  text: text("text").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Reserved `commentator.country_code` keys for the bot's own identity.
export const COMMENTATOR_NAME_KEY = "__name__";
export const COMMENTATOR_PHOTO_KEY = "__photo__";

// Generic key-value bag for "facts" the admin enters (jury winner,
// televote winner, nul-points country, etc.) used to score side bets
// against. Extending the bet menu later doesn't require a new column.
export const officialFacts = pgTable("official_facts", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Per-room override of official_results, for async parties watching at a
// different time. When a room has any rows here, the leaderboard scores
// against these instead of the global official_results.
export const roomResults = pgTable(
  "room_results",
  {
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    countryCode: varchar("country_code", { length: 2 }).notNull(),
    placement: integer("placement").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.roomId, t.countryCode] })],
);

// Per-room override of official_facts. Same fallback semantics as
// roomResults: any rows here take precedence over the global table for
// this room only.
export const roomFacts = pgTable(
  "room_facts",
  {
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    value: text("value").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.roomId, t.key] })],
);

export const roomsRelations = relations(rooms, ({ many }) => ({
  voters: many(voters),
  reactions: many(reactions),
  settings: many(roomSettings),
}));

export const votersRelations = relations(voters, ({ one, many }) => ({
  room: one(rooms, { fields: [voters.roomId], references: [rooms.id] }),
  votes: many(votes),
}));

export const votesRelations = relations(votes, ({ one }) => ({
  voter: one(voters, { fields: [votes.voterId], references: [voters.id] }),
}));

// Chat messages. Persistent so users see history when they re-open the
// room. `kind` discriminates plain text from special cards (GIF, bingo
// strike, future system messages). `meta` is a free-form jsonb bag so
// adding new kinds doesn't need a migration.
export type ChatMessageKind =
  | "text"
  | "gif"
  | "image"
  | "bingo_strike"
  | "system"
  | "now_playing"
  | "results"
  // "trivia": one-question card for the on-stage country. Posted by
  // the server when the admin flips nowPlayingCode (if the country
  // has a trivia entry in lib/trivia.ts). Renders inline in the
  // thread; player taps an option to lock their answer. Replaces the
  // floating popup the old TriviaCard component used.
  | "trivia"
  // "poll": a one-tap "vibe check" the host fires from the admin
  // broadcast panel. Meta carries the question + 4 emoji choices;
  // votes ride on top of the existing chat_reactions table (one
  // reaction = one vote, the client enforces single-choice by
  // toggling any prior choice off before adding the new one), so
  // the chat:react broadcast already keeps every viewer's tally in
  // sync without a new event type.
  | "poll";

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    sessionId: varchar("session_id", { length: 64 }).notNull(),
    name: varchar("name", { length: 40 }).notNull(),
    avatarId: varchar("avatar_id", { length: 40 }),
    kind: varchar("kind", { length: 16 })
      .$type<ChatMessageKind>()
      .notNull()
      .default("text"),
    body: text("body"),
    gifUrl: text("gif_url"),
    replyTo: uuid("reply_to"),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("chat_room_created_idx").on(t.roomId, t.createdAt),
    // Per-author lookups (profile drawer, leaderboard highlights,
    // admin moderation) — without this they fall back to a filter on
    // the (room, createdAt) index.
    index("chat_room_session_idx").on(t.roomId, t.sessionId),
  ],
);

// One row per (message, session, emoji). Lets the same user react with
// multiple emojis on the same message but not the same emoji twice.
export const chatReactions = pgTable(
  "chat_reactions",
  {
    messageId: uuid("message_id")
      .notNull()
      .references(() => chatMessages.id, { onDelete: "cascade" }),
    sessionId: varchar("session_id", { length: 64 }).notNull(),
    name: varchar("name", { length: 40 }).notNull(),
    emoji: text("emoji").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.messageId, t.sessionId, t.emoji] }),
    index("chat_react_msg_idx").on(t.messageId),
    // Per-session lookup: the profile route's "reactions given"
    // count + the chat-edit moderation join filter on session_id
    // alone. The PK is leftmost-prefix (message_id, session_id, …)
    // so the planner can't use it for session-only filters; this
    // covering index keeps those endpoints off a seq-scan as the
    // table grows.
    index("chat_react_session_idx").on(t.sessionId),
  ],
);

// GIF search cache. Klipy's free tier is enough for a busy room but
// repeated identical searches still cost a quota burn; the cache key
// is the lowercased query, TTL handled in the API route (24h).
export const gifCache = pgTable("gif_cache", {
  q: text("q").primaryKey(),
  results: jsonb("results").notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Durable cache for AI-generated chat helpers. Each row stores ONE
// (kind, text) → result pair so subsequent identical lookups can
// skip the Anthropic round-trip even across cold serverless instances.
//
//   - `kind`     = "translate" (LT → EN rendering) or "beginner"
//                  (Eurovision-joke unpack). Future kinds slot in
//                  without a migration.
//   - `text_key` = sha256 of the input text (full text would blow
//                  past the index size; the hash is plenty for a
//                  cache key and keeps duplicates from re-rolling).
//   - `payload`  = JSON `{ translate / explain: boolean, text: string }`
//                  matching the route's response shape.
//   - `hits`     = bump every cache hit. Useful for "evict the cold
//                  half" eviction once the table grows.
//
// Wired by /api/translate (today) and the beginner-mode route (later
// — beginner_mode_enabled is the toggle column on rooms). The
// in-memory route caches stay; this table is the second tier.
export const chatHelperCache = pgTable(
  "chat_helper_cache",
  {
    kind: varchar("kind", { length: 16 }).notNull(),
    textKey: text("text_key").notNull(),
    lang: varchar("lang", { length: 2 }).notNull(),
    payload: jsonb("payload").notNull(),
    hits: integer("hits").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.kind, t.textKey, t.lang] })],
);

// Web Push subscriptions. One row per (room, session, endpoint) so a
// voter can opt into notifications from multiple rooms; deleting a
// row unsubscribes that subscription. `prefs` is a jsonb bag of bool
// toggles — see lib/push-prefs.ts for the shape.

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    sessionId: varchar("session_id", { length: 64 }).notNull(),
    voterName: varchar("voter_name", { length: 40 }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    prefs: jsonb("prefs").$type<PushPrefs>().notNull().default({}),
    /** Subscriber's preferred language at subscribe time. Persisted
     *  so push bodies can be rendered in their language (not the
     *  sender's). NULL falls back to LT (the app default). */
    lang: varchar("lang", { length: 2 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("push_subs_room_idx").on(t.roomId),
    uniqueIndex("push_subs_endpoint_unique").on(t.roomId, t.endpoint),
  ],
);

// Trivia answers — one per (room, session, country). The trivia bank
// itself lives in `lib/trivia.ts` (pure data, no DB). The server
// validates the choiceIndex against that bank at answer time and stores
// only the boolean correctness here, so the leaderboard can add +2 per
// hit to the player's total.
export const triviaAnswers = pgTable(
  "trivia_answers",
  {
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    sessionId: varchar("session_id", { length: 64 }).notNull(),
    countryCode: varchar("country_code", { length: 2 }).notNull(),
    choiceIndex: integer("choice_index").notNull(),
    correct: boolean("correct").notNull(),
    answeredAt: timestamp("answered_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  // Primary key (room_id, session_id, country_code) doubles as the
  // room-only lookup index via leftmost-prefix matching. The trivia
  // answer cap also does `COUNT(*) WHERE room_id=? AND country_code=?`
  // which the PK can't serve (session_id is in the middle of the
  // PK), so a covering (room_id, country_code) index sits alongside.
  (t) => [
    primaryKey({ columns: [t.roomId, t.sessionId, t.countryCode] }),
    index("trivia_room_country_idx").on(t.roomId, t.countryCode),
  ],
);

// Editable trivia deck (one row per finalist country). lib/trivia.ts
// ships a default deck for fresh installs and any country the admin
// hasn't overridden yet; this table carries the live overrides. The
// admin UI replaces the whole deck wholesale, so reads always merge:
// DB row if present, file row otherwise.
export const triviaQuestions = pgTable("trivia_questions", {
  countryCode: varchar("country_code", { length: 2 }).primaryKey(),
  correctIndex: integer("correct_index").notNull(),
  enQuestion: text("en_question").notNull(),
  enChoices: text("en_choices").array().notNull(),
  ltQuestion: text("lt_question").notNull(),
  ltChoices: text("lt_choices").array().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Tiny global key/value store for editable site content. Today it
// carries `welcome_md_en` / `welcome_md_lt` (the housekeeping markdown
// rendered as the closing widget on the room home), but the shape is
// intentionally generic — future surfaces can add a new key without a
// migration. Kept separate from `official_facts` so any-fact-exists
// heuristics in scoring don't pick up unrelated content.
export const siteContent = pgTable("site_content", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Postgres-backed rate-limit buckets. Replaces the in-memory floodCheck
// that was only as durable as one warm serverless instance.
// `bucket` is a free-form string the caller composes — convention is
// "<kind>:<roomId>:<sessionId>" so different write paths share the
// helper without colliding.
export const rateLimits = pgTable("rate_limits", {
  bucket: text("bucket").primaryKey(),
  hits: integer("hits").notNull().default(0),
  windowStart: timestamp("window_start", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// WebAuthn / passkey credentials for the single admin user. Initial enrollment
// is gated by the ADMIN_BOOTSTRAP_SECRET env var; once at least one credential
// exists, the bootstrap secret is no longer accepted and only the registered
// passkeys can sign in.
export const adminCredentials = pgTable("admin_credentials", {
  id: text("id").primaryKey(), // base64url credential ID
  publicKey: text("public_key").notNull(), // base64url COSE public key
  counter: integer("counter").notNull().default(0),
  transports: text("transports"),
  label: text("label").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
});

export type AdminCredential = typeof adminCredentials.$inferSelect;

export type Room = typeof rooms.$inferSelect;
export type NewRoom = typeof rooms.$inferInsert;
export type Voter = typeof voters.$inferSelect;
export type Vote = typeof votes.$inferSelect;
export type Reaction = typeof reactions.$inferSelect;

// Eurovision points scale.
export const POINT_VALUES = [12, 10, 8, 7, 6, 5, 4, 3, 2, 1] as const;
export type PointValue = (typeof POINT_VALUES)[number];

export const ballotKeepalive = sql`now()`;
