-- Schema bootstrap: concatenated drizzle migrations 0000..0020, in order.
-- Run BEFORE neon-dump.sql against an empty Supabase.


-- ===== drizzle/0000_init_rooms.sql =====
-- Initial schema for the rooms-aware Eurovision voting app.
-- Generated to bootstrap a fresh Neon database. If you're migrating from the
-- legacy single-room Supabase schema, run scripts/migrate-supabase.sql
-- afterwards (it copies the old voters/votes tables into a "default" room).

CREATE TABLE IF NOT EXISTS "rooms" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "code" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "voting_enabled" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "last_active_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "rooms_code_idx" ON "rooms" ("code");

CREATE TABLE IF NOT EXISTS "voters" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "room_id" uuid NOT NULL REFERENCES "rooms"("id") ON DELETE CASCADE,
  "session_id" text NOT NULL,
  "name" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "voters_room_idx" ON "voters" ("room_id");
CREATE INDEX IF NOT EXISTS "voters_session_idx" ON "voters" ("room_id", "session_id");
CREATE UNIQUE INDEX IF NOT EXISTS "voters_room_session_unique"
  ON "voters" ("room_id", "session_id");

CREATE TABLE IF NOT EXISTS "votes" (
  "voter_id" uuid NOT NULL REFERENCES "voters"("id") ON DELETE CASCADE,
  "points" integer NOT NULL,
  "country_code" text NOT NULL,
  PRIMARY KEY ("voter_id", "points")
);
CREATE INDEX IF NOT EXISTS "votes_country_idx" ON "votes" ("country_code");

CREATE TABLE IF NOT EXISTS "reactions" (
  "room_id" uuid NOT NULL REFERENCES "rooms"("id") ON DELETE CASCADE,
  "country_code" text NOT NULL,
  "emoji" text NOT NULL,
  "count" integer NOT NULL DEFAULT 0,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("room_id", "country_code", "emoji")
);

CREATE TABLE IF NOT EXISTS "room_settings" (
  "room_id" uuid NOT NULL REFERENCES "rooms"("id") ON DELETE CASCADE,
  "key" text NOT NULL,
  "value" text NOT NULL,
  PRIMARY KEY ("room_id", "key")
);

CREATE TABLE IF NOT EXISTS "admin_credentials" (
  "id" text PRIMARY KEY,
  "public_key" text NOT NULL,
  "counter" integer NOT NULL DEFAULT 0,
  "transports" text,
  "label" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "last_used_at" timestamptz
);

-- Live scoreboard view: aggregate points per (room, country) ordered by total.
CREATE OR REPLACE VIEW "scoreboard" AS
SELECT
  v.room_id                                AS room_id,
  votes.country_code                       AS country_code,
  COALESCE(SUM(votes.points), 0)           AS total_points,
  SUM(CASE WHEN votes.points = 12 THEN 1 ELSE 0 END) AS points_12,
  SUM(CASE WHEN votes.points = 10 THEN 1 ELSE 0 END) AS points_10,
  SUM(CASE WHEN votes.points =  8 THEN 1 ELSE 0 END) AS points_8,
  SUM(CASE WHEN votes.points =  7 THEN 1 ELSE 0 END) AS points_7,
  SUM(CASE WHEN votes.points =  6 THEN 1 ELSE 0 END) AS points_6,
  SUM(CASE WHEN votes.points =  5 THEN 1 ELSE 0 END) AS points_5,
  SUM(CASE WHEN votes.points =  4 THEN 1 ELSE 0 END) AS points_4,
  SUM(CASE WHEN votes.points =  3 THEN 1 ELSE 0 END) AS points_3,
  SUM(CASE WHEN votes.points =  2 THEN 1 ELSE 0 END) AS points_2,
  SUM(CASE WHEN votes.points =  1 THEN 1 ELSE 0 END) AS points_1
FROM votes
JOIN voters v ON v.id = votes.voter_id
GROUP BY v.room_id, votes.country_code;

-- ===== drizzle/0001_betting.sql =====
-- Adds the betting / scoring infrastructure on top of 0000_init_rooms.sql.
-- Safe to run on databases that already have the v1 schema applied.

-- Per-room "where will Lithuania finish?" target country.
ALTER TABLE "rooms"
  ADD COLUMN IF NOT EXISTS "home_country_code" text NOT NULL DEFAULT 'lt';

-- Per-voter prediction of that country's final placement (1..N).
ALTER TABLE "voters"
  ADD COLUMN IF NOT EXISTS "home_country_prediction" integer;

-- Single global table holding the official Eurovision result. Admin
-- populates after the show ends; the leaderboard joins voters' ballots
-- against this to compute scores.
CREATE TABLE IF NOT EXISTS "official_results" (
  "country_code" text PRIMARY KEY,
  "placement" integer NOT NULL,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- ===== drizzle/0002_side_bets.sql =====
-- Side-bet columns for the prediction game's "fun bets" expansion.
-- All nullable, optional inputs alongside the existing top-10 ballot.

ALTER TABLE "voters"
  ADD COLUMN IF NOT EXISTS "bet_wooden_spoon"     text,
  ADD COLUMN IF NOT EXISTS "bet_lt_12_to"          text,
  ADD COLUMN IF NOT EXISTS "bet_highest_big5"      text,
  ADD COLUMN IF NOT EXISTS "bet_jury_winner"       text,
  ADD COLUMN IF NOT EXISTS "bet_televote_winner"   text,
  ADD COLUMN IF NOT EXISTS "bet_nul_televote"      text,
  ADD COLUMN IF NOT EXISTS "bet_same_winners"      boolean,
  ADD COLUMN IF NOT EXISTS "bet_lt_top10"          boolean,
  ADD COLUMN IF NOT EXISTS "bet_lt_top5"           boolean,
  ADD COLUMN IF NOT EXISTS "bet_host_top3"         boolean,
  ADD COLUMN IF NOT EXISTS "bet_winner_solo"       boolean;

-- Generic key-value table for "facts" the admin enters that aren't derivable
-- from official_results placements alone. Keys we use today:
--   jury_winner          (country code)
--   televote_winner      (country code)
--   nul_televote         (country code, or 'NONE')
--   lt_12_to             (country LT gave its 12 to)
--   winner_solo          ('true' or 'false')
-- Easy to extend with more bets without further schema migrations.
CREATE TABLE IF NOT EXISTS "official_facts" (
  "key" text PRIMARY KEY,
  "value" text NOT NULL,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- ===== drizzle/0003_bet_refinements.sql =====
-- 0003: bet refinements
--   * drop redundant LT top10 / top5 (covered by LT placement scoring)
--   * convert nul-televote from a single country pick to a text[] array
--     so voters can hedge with multiple guesses + the "NONE" sentinel.

ALTER TABLE "voters"
  DROP COLUMN IF EXISTS "bet_lt_top10",
  DROP COLUMN IF EXISTS "bet_lt_top5";

-- text  ->  text[].  Wrap any existing single value into a one-element array;
-- nulls stay null. USING handles the cast cleanly.
ALTER TABLE "voters"
  ALTER COLUMN "bet_nul_televote" TYPE text[]
  USING (
    CASE
      WHEN "bet_nul_televote" IS NULL THEN NULL
      ELSE ARRAY["bet_nul_televote"]
    END
  );

-- ===== drizzle/0004_room_admin.sql =====
-- 0004: per-room admin tokens + per-room results/facts overrides

-- Long random admin token for the per-room admin link. Backfill any rows
-- that pre-date this migration with a 32-char gen_random_uuid()-derived
-- string (Neon ships this; pgcrypto's gen_random_bytes is NOT available).
ALTER TABLE "rooms"
  ADD COLUMN IF NOT EXISTS "admin_token" text;

UPDATE "rooms"
SET "admin_token" = replace(gen_random_uuid()::text, '-', '')
                 || replace(gen_random_uuid()::text, '-', '')
WHERE "admin_token" IS NULL;

ALTER TABLE "rooms"
  ALTER COLUMN "admin_token" SET NOT NULL;

CREATE TABLE IF NOT EXISTS "room_results" (
  "room_id" uuid NOT NULL REFERENCES "rooms"("id") ON DELETE CASCADE,
  "country_code" text NOT NULL,
  "placement" integer NOT NULL,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("room_id", "country_code")
);

CREATE TABLE IF NOT EXISTS "room_facts" (
  "room_id" uuid NOT NULL REFERENCES "rooms"("id") ON DELETE CASCADE,
  "key" text NOT NULL,
  "value" text NOT NULL,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("room_id", "key")
);

-- ===== drizzle/0005_tally_and_lt_total.sql =====
-- 0005: tally toggle + lt-total-points bet
ALTER TABLE "rooms"
  ADD COLUMN IF NOT EXISTS "tally_enabled" boolean NOT NULL DEFAULT false;

ALTER TABLE "voters"
  ADD COLUMN IF NOT EXISTS "bet_lt_total_points" integer;

-- ===== drizzle/0006_now_playing.sql =====
-- 0006 — now-playing column on rooms.
-- The admin (host) flips this to the country currently performing on
-- stage. Server broadcasts "now-playing:change" to every client in
-- the room; clients render a top strip + spawn a heart-flag swarm.
-- NULL = no country highlighted right now.

ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS now_playing_code text;

-- ===== drizzle/0007_push.sql =====
-- 0007 — Web Push subscriptions.
-- One row per (room, endpoint). Voters can opt into push from multiple
-- rooms independently. prefs jsonb controls which categories of event
-- trigger a notification — adding categories doesn't need a migration.

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  session_id  text NOT NULL,
  voter_name  text,
  endpoint    text NOT NULL,
  p256dh      text NOT NULL,
  auth        text NOT NULL,
  prefs       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_subs_room_idx
  ON push_subscriptions (room_id);

CREATE UNIQUE INDEX IF NOT EXISTS push_subs_endpoint_unique
  ON push_subscriptions (room_id, endpoint);

-- ===== drizzle/0008_chat.sql =====
-- 0008 — Persistent chat. Messages + reactions, scoped per room.
-- Chat is text, GIFs (Klipy), and special "card" kinds (bingo_strike,
-- and any future system message). `meta` jsonb lets us add new kinds
-- without further migrations.

CREATE TABLE IF NOT EXISTS chat_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id    uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  name       text NOT NULL,
  avatar_id  text,
  kind       text NOT NULL DEFAULT 'text',
  body       text,
  gif_url    text,
  reply_to   uuid,
  meta       jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_room_created_idx
  ON chat_messages (room_id, created_at);

CREATE TABLE IF NOT EXISTS chat_reactions (
  message_id uuid NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  name       text NOT NULL,
  emoji      text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, session_id, emoji)
);

CREATE INDEX IF NOT EXISTS chat_react_msg_idx
  ON chat_reactions (message_id);

-- ===== drizzle/0009_gif_cache.sql =====
-- 0009 — GIF search cache (Klipy proxy).
-- Identical search queries hit our DB before hitting Klipy. The API
-- route enforces a 24h TTL on `fetched_at`. PK is the lowercased
-- query so case-sensitive variants share the same cache.

CREATE TABLE IF NOT EXISTS gif_cache (
  q          text PRIMARY KEY,
  results    jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

-- ===== drizzle/0010_show_status.sql =====
-- 0010 — Coarse show-state on rooms.
-- Admin flips through:
--   not_started → in_progress → break → ended → not_started
-- Voters see different header copy + the tabs hint at "Voting opens"
-- vs "On stage now" vs "Results coming" depending on the value.

ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS show_status text NOT NULL DEFAULT 'not_started';

-- ===== drizzle/0011_running_order.sql =====
-- 0011 — running-order position on rooms.
-- 1-based index of the act currently on stage (e.g. 12 of 26). The host
-- sets it from the live admin panel alongside now-playing; clients draw a
-- progress bar on the now-playing hero. NULL = unknown / not tracking.

ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS running_order_pos integer;

-- ===== drizzle/0012_commentator.sql =====
-- Live commentator: one editable line per country, plus the bot's own
-- name + photo stored as the special rows '__name__' / '__photo__'.
-- When the host puts a country on stage, the bot drops that country's
-- line into chat. Global to the installation (one commentator).
CREATE TABLE IF NOT EXISTS "commentator" (
  "country_code" text PRIMARY KEY NOT NULL,
  "text" text NOT NULL,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- ===== drizzle/0013_room_commentator.sql =====
-- Per-room mute for the live-commentator bot. The commentator is
-- configured globally (one bot, one set of country lines) but a host can
-- silence it for their own room from the magic admin link.
ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "commentator_enabled" boolean NOT NULL DEFAULT true;

-- ===== drizzle/0014_trivia.sql =====
-- Trivia answers: one row per (room, session, country). Records the
-- player's choice and whether it was right, so the leaderboard can add
-- +2 per correct answer to their total. Idempotent insert (the primary
-- key locks down a single answer per country per player).
CREATE TABLE IF NOT EXISTS "trivia_answers" (
  "room_id" uuid NOT NULL REFERENCES "rooms"("id") ON DELETE CASCADE,
  "session_id" text NOT NULL,
  "country_code" text NOT NULL,
  "choice_index" integer NOT NULL,
  "correct" boolean NOT NULL,
  "answered_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("room_id", "session_id", "country_code")
);
CREATE INDEX IF NOT EXISTS "trivia_answers_room_idx" ON "trivia_answers" ("room_id");

-- ===== drizzle/0015_chat_session_idx.sql =====
-- Per-session chat lookups: profile drawer, leaderboard's "highlights"
-- aggregation, admin moderation. All filter chat_messages by (room_id,
-- session_id); without this index they fall back to the existing
-- (room_id, created_at) one and scan with a session_id filter.
CREATE INDEX IF NOT EXISTS "chat_room_session_idx"
  ON "chat_messages" ("room_id", "session_id");

-- ===== drizzle/0016_rate_limits.sql =====
-- Postgres-backed rate-limit bucket. One row per (kind, room, session)
-- combination. The route handler upserts each hit; if the row's window
-- has expired the counter resets to 1, otherwise it increments and the
-- handler decides whether to 429.
--
-- Rows are tiny (~100 bytes) and survive cold starts, so this works
-- where the in-memory floodCheck didn't — three serverless instances
-- can no longer triple the effective cap by accident.
CREATE TABLE IF NOT EXISTS "rate_limits" (
  "bucket"       text PRIMARY KEY,
  "hits"         integer NOT NULL DEFAULT 0,
  "window_start" timestamptz NOT NULL DEFAULT now()
);

-- ===== drizzle/0017_drop_bet_same_winners.sql =====
-- Drop the dead `bet_same_winners` column. The bet itself was removed
-- from the menu in an earlier pass (it duplicated jury+televote winner
-- picks) and the votes route was writing NULL to satisfy the schema.
-- No code reads it, no code writes it — safe to delete.
ALTER TABLE "voters" DROP COLUMN IF EXISTS "bet_same_winners";

-- ===== drizzle/0018_trivia_threshold_beginner_helper_cache.sql =====
-- Trivia threshold: per-room cap on how many players can answer a
-- single trivia question. NULL = unlimited (existing behaviour).
ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "trivia_max_answerers" integer;

-- Beginner mode: per-room toggle for the upcoming "what does this
-- Eurovision joke mean" helper. Same shape as translate's per-user
-- toggle but lives on the room so the host decides the room's
-- audience. Off by default — most rooms know the contest.
ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "beginner_mode_enabled" boolean NOT NULL DEFAULT false;

-- Durable cache for chat helpers (translate today, beginner-mode
-- tomorrow). PRIMARY KEY (kind, text_key, lang) lets a single table
-- back multiple "AI rewrites a chat line" features without a new
-- migration per kind. text_key is a sha256 of the input.
CREATE TABLE IF NOT EXISTS "chat_helper_cache" (
  "kind"       text NOT NULL,
  "text_key"   text NOT NULL,
  "lang"       text NOT NULL,
  "payload"    jsonb NOT NULL,
  "hits"       integer NOT NULL DEFAULT 1,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("kind", "text_key", "lang")
);

-- ===== drizzle/0019_drop_beginner_room_flag.sql =====
-- Undo: rooms.beginner_mode_enabled was added in 0018 on the (wrong)
-- assumption that beginner mode would be a per-room toggle. It's
-- actually per-USER (localStorage, same shape as translate mode). The
-- column has no readers in code and no rows depend on it, so drop it
-- before it accumulates state we'd have to back out later.
--
-- The `chat_helper_cache` table from 0018 stays — it's the shared
-- durable cache for translate + beginner-mode explanations and that
-- design is still correct.
ALTER TABLE "rooms" DROP COLUMN IF EXISTS "beginner_mode_enabled";

-- ===== drizzle/0020_schema_audit.sql =====
-- Pre-Supabase audit pass. Three groups of changes:
--
--   1. Type narrowing: bounded strings (ISO codes, room codes, session
--      IDs, enum kinds, user-entered names with Zod max() caps) move
--      from `text` to `varchar(N)`. No data is lost — every cap here
--      is verified against the corresponding Zod validator or against
--      the generator that emits the column.
--   2. CHECK constraints: cheap correctness fences for enums + counters
--      whose invalid states the app never produces but nothing
--      structurally prevents (a stray UPDATE could land us in an
--      illegal state today). Adding these now means Supabase inherits
--      a stricter schema and any future regression trips at write time.
--   3. Drop one redundant single-column index: `trivia_answers_room_idx`
--      duplicates the leftmost prefix of the table's primary key
--      `(room_id, session_id, country_code)`, which the planner is
--      happy to use for room-only lookups.
--
-- Each statement runs standalone via the @neondatabase/serverless
-- HTTP driver (the migration runner can't wrap the file in a
-- transaction). Order matters: drop the dependent view first, then
-- type narrowings, then CHECK adds, then the index drop, then
-- recreate the view against the new column types. Any single
-- failure aborts the run and the rest is safe to re-apply.

-- ─── 0. Drop dependent view ─────────────────────────────────────

-- The `scoreboard` view from migration 0000 references
-- votes.country_code, so Postgres blocks any type change on that
-- column. Drop it now; we recreate at the end against the
-- narrowed type with the exact same shape.
DROP VIEW IF EXISTS "scoreboard";

-- ─── 1. Type narrowing ──────────────────────────────────────────

-- Room codes: 6-char uppercase alphanumeric, generated by
-- customAlphabet("23456789ABCDEFGHJKMNPQRSTUVWXYZ", 6). varchar(8)
-- gives headroom if we ever lengthen.
ALTER TABLE "rooms" ALTER COLUMN "code" TYPE varchar(8);

-- Room name: user-entered, capped at 60 by Zod (see app/api/rooms
-- /route.ts and app/api/admin/rooms/[code]/route.ts).
ALTER TABLE "rooms" ALTER COLUMN "name" TYPE varchar(60);

-- Show-status enum: not_started | in_progress | break | ended.
ALTER TABLE "rooms" ALTER COLUMN "show_status" TYPE varchar(16);

-- ISO 3166-1 alpha-2 (lowercase). Always exactly two chars.
ALTER TABLE "rooms" ALTER COLUMN "home_country_code" TYPE varchar(2);
ALTER TABLE "rooms" ALTER COLUMN "now_playing_code" TYPE varchar(2);
ALTER TABLE "votes" ALTER COLUMN "country_code" TYPE varchar(2);
ALTER TABLE "reactions" ALTER COLUMN "country_code" TYPE varchar(2);
ALTER TABLE "official_results" ALTER COLUMN "country_code" TYPE varchar(2);
ALTER TABLE "room_results" ALTER COLUMN "country_code" TYPE varchar(2);
ALTER TABLE "trivia_answers" ALTER COLUMN "country_code" TYPE varchar(2);

-- Bonus-bet picks: ISO2 country code OR the sentinel "NONE" (4 chars).
ALTER TABLE "voters" ALTER COLUMN "bet_wooden_spoon" TYPE varchar(4);
ALTER TABLE "voters" ALTER COLUMN "bet_lt_12_to" TYPE varchar(4);
ALTER TABLE "voters" ALTER COLUMN "bet_highest_big5" TYPE varchar(4);
ALTER TABLE "voters" ALTER COLUMN "bet_jury_winner" TYPE varchar(4);
ALTER TABLE "voters" ALTER COLUMN "bet_televote_winner" TYPE varchar(4);

-- Session IDs: minted by ensureSessionId() as `s_` + 12 base36 chars
-- (lib/use-identity.ts), so always 14 chars. varchar(64) is generous
-- in case we ever swap the generator.
ALTER TABLE "voters" ALTER COLUMN "session_id" TYPE varchar(64);
ALTER TABLE "chat_messages" ALTER COLUMN "session_id" TYPE varchar(64);
ALTER TABLE "chat_reactions" ALTER COLUMN "session_id" TYPE varchar(64);
ALTER TABLE "trivia_answers" ALTER COLUMN "session_id" TYPE varchar(64);
ALTER TABLE "push_subscriptions" ALTER COLUMN "session_id" TYPE varchar(64);

-- User-entered display names: capped at 40 by Zod across every write
-- path that accepts them (chat, reactions, votes, push).
ALTER TABLE "voters" ALTER COLUMN "name" TYPE varchar(40);
ALTER TABLE "chat_messages" ALTER COLUMN "name" TYPE varchar(40);
ALTER TABLE "chat_reactions" ALTER COLUMN "name" TYPE varchar(40);
ALTER TABLE "push_subscriptions" ALTER COLUMN "voter_name" TYPE varchar(40);

-- Avatar IDs: slug-form like "kaarija-2023" from lib/avatars.ts.
-- Longest entries sit around 20 chars; varchar(40) covers any future
-- naming.
ALTER TABLE "chat_messages" ALTER COLUMN "avatar_id" TYPE varchar(40);

-- Chat message kind enum (8 values today).
ALTER TABLE "chat_messages" ALTER COLUMN "kind" TYPE varchar(16);

-- Chat helper cache kind enum (translate | beginner) + lang code.
ALTER TABLE "chat_helper_cache" ALTER COLUMN "kind" TYPE varchar(16);
ALTER TABLE "chat_helper_cache" ALTER COLUMN "lang" TYPE varchar(2);


-- ─── 2. CHECK constraints ──────────────────────────────────────

-- Eurovision points scale. POINT_VALUES in lib/db/schema.ts is the
-- canonical source of truth.
ALTER TABLE "votes"
  ADD CONSTRAINT "votes_points_chk"
  CHECK ("points" IN (1, 2, 3, 4, 5, 6, 7, 8, 10, 12));

-- Reaction counter only ever increments; this guards an accidental
-- negative write.
ALTER TABLE "reactions"
  ADD CONSTRAINT "reactions_count_nonneg_chk"
  CHECK ("count" >= 0);

-- Eurovision placements are 1..N (no zero or negative).
ALTER TABLE "official_results"
  ADD CONSTRAINT "official_results_placement_chk"
  CHECK ("placement" >= 1);
ALTER TABLE "room_results"
  ADD CONSTRAINT "room_results_placement_chk"
  CHECK ("placement" >= 1);

-- "Where will home country finish?" prediction shares the same 1..N
-- range as the official placement. Nullable, so NULL is fine.
ALTER TABLE "voters"
  ADD CONSTRAINT "voters_home_country_prediction_chk"
  CHECK ("home_country_prediction" IS NULL OR "home_country_prediction" >= 1);

-- LT-total-points bet: 0 or positive. Nullable.
ALTER TABLE "voters"
  ADD CONSTRAINT "voters_bet_lt_total_points_chk"
  CHECK ("bet_lt_total_points" IS NULL OR "bet_lt_total_points" >= 0);

-- Show-status enum lock. Mirrors the Zod enum in
-- app/api/admin/live/route.ts.
ALTER TABLE "rooms"
  ADD CONSTRAINT "rooms_show_status_chk"
  CHECK ("show_status" IN ('not_started', 'in_progress', 'break', 'ended'));

-- Running-order position: 1..N. Nullable.
ALTER TABLE "rooms"
  ADD CONSTRAINT "rooms_running_order_pos_chk"
  CHECK ("running_order_pos" IS NULL OR "running_order_pos" >= 1);

-- Trivia-cap: at least one answerer per question if a cap is set.
ALTER TABLE "rooms"
  ADD CONSTRAINT "rooms_trivia_max_answerers_chk"
  CHECK ("trivia_max_answerers" IS NULL OR "trivia_max_answerers" >= 1);

-- Chat-message kind enum (ChatMessageKind in lib/db/schema.ts).
ALTER TABLE "chat_messages"
  ADD CONSTRAINT "chat_messages_kind_chk"
  CHECK ("kind" IN (
    'text', 'gif', 'image', 'bingo_strike',
    'system', 'now_playing', 'results', 'trivia'
  ));

-- Chat-helper cache: kind is one of the two AI-rewrite features we
-- back through this table.
ALTER TABLE "chat_helper_cache"
  ADD CONSTRAINT "chat_helper_cache_kind_chk"
  CHECK ("kind" IN ('translate', 'beginner'));
ALTER TABLE "chat_helper_cache"
  ADD CONSTRAINT "chat_helper_cache_hits_chk"
  CHECK ("hits" >= 0);

-- Trivia bank always emits exactly 4 choices (lib/trivia.ts), so
-- valid indices are 0..3.
ALTER TABLE "trivia_answers"
  ADD CONSTRAINT "trivia_answers_choice_chk"
  CHECK ("choice_index" >= 0 AND "choice_index" <= 3);

-- Rate-limit hit counter is monotonically non-negative.
ALTER TABLE "rate_limits"
  ADD CONSTRAINT "rate_limits_hits_chk"
  CHECK ("hits" >= 0);


-- ─── 3. Drop redundant index ───────────────────────────────────

-- Primary key on trivia_answers is (room_id, session_id, country_code).
-- Postgres uses the leftmost prefix of the PK btree for `WHERE room_id
-- = $1` lookups, so the single-column index on room_id was redundant.
DROP INDEX IF EXISTS "trivia_answers_room_idx";


-- ─── 4. Recreate scoreboard view ───────────────────────────────

-- Same definition as the one originally created in 0000, but now
-- typed against the narrowed votes.country_code (varchar(2)). The
-- view body itself is unchanged.
CREATE OR REPLACE VIEW "scoreboard" AS
SELECT
  v.room_id                                AS room_id,
  votes.country_code                       AS country_code,
  COALESCE(SUM(votes.points), 0)           AS total_points,
  SUM(CASE WHEN votes.points = 12 THEN 1 ELSE 0 END) AS points_12,
  SUM(CASE WHEN votes.points = 10 THEN 1 ELSE 0 END) AS points_10,
  SUM(CASE WHEN votes.points =  8 THEN 1 ELSE 0 END) AS points_8,
  SUM(CASE WHEN votes.points =  7 THEN 1 ELSE 0 END) AS points_7,
  SUM(CASE WHEN votes.points =  6 THEN 1 ELSE 0 END) AS points_6,
  SUM(CASE WHEN votes.points =  5 THEN 1 ELSE 0 END) AS points_5,
  SUM(CASE WHEN votes.points =  4 THEN 1 ELSE 0 END) AS points_4,
  SUM(CASE WHEN votes.points =  3 THEN 1 ELSE 0 END) AS points_3,
  SUM(CASE WHEN votes.points =  2 THEN 1 ELSE 0 END) AS points_2,
  SUM(CASE WHEN votes.points =  1 THEN 1 ELSE 0 END) AS points_1
FROM votes
JOIN voters v ON v.id = votes.voter_id
GROUP BY v.room_id, votes.country_code;
