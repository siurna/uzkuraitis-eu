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
