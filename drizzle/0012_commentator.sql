-- Live commentator: one editable line per country, plus the bot's own
-- name + photo stored as the special rows '__name__' / '__photo__'.
-- When the host puts a country on stage, the bot drops that country's
-- line into chat. Global to the installation (one commentator).
CREATE TABLE IF NOT EXISTS "commentator" (
  "country_code" text PRIMARY KEY NOT NULL,
  "text" text NOT NULL,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
