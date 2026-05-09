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
