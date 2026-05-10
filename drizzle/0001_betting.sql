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
