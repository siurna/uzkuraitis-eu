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
