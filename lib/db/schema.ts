import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  primaryKey,
  uuid,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// A "room" is one watch-along group. Friends share a room code (e.g. "ABC123")
// and only see each other's votes & reactions.
export const rooms = pgTable(
  "rooms",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    votingEnabled: boolean("voting_enabled").notNull().default(true),
    // ISO 3166-1 alpha-2 lowercase. Used to ask voters where they think
    // this country will finish, scored separately from the top-10 ballot.
    homeCountryCode: text("home_country_code").notNull().default("lt"),
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
    sessionId: text("session_id").notNull(),
    name: text("name").notNull(),
    // Predicted final placement for this room's home country (e.g. "where
    // will Lithuania finish?"). Range 1..N where N is the number of
    // finalists. Nullable: voters who skip this still cast their ballot.
    homeCountryPrediction: integer("home_country_prediction"),
    // --- Side bets ("bonus predictions"). All optional. ---
    // Country picks (ISO 3166-1 alpha-2 lowercase, or 'NONE' for nul-points).
    betWoodenSpoon: text("bet_wooden_spoon"),
    betLt12To: text("bet_lt_12_to"),
    betHighestBig5: text("bet_highest_big5"),
    betJuryWinner: text("bet_jury_winner"),
    betTelevoteWinner: text("bet_televote_winner"),
    // Nul-points televote: voter can pick MULTIPLE country guesses, plus
    // an optional "NONE" sentinel for "no country gets zero". Stored as a
    // Postgres text[] array.
    betNulTelevote: text("bet_nul_televote").array(),
    // Yes/no flags.
    betSameWinners: boolean("bet_same_winners"),
    betHostTop3: boolean("bet_host_top3"),
    betWinnerSolo: boolean("bet_winner_solo"),
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
    countryCode: text("country_code").notNull(),
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
    countryCode: text("country_code").notNull(),
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
  countryCode: text("country_code").primaryKey(),
  placement: integer("placement").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

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
