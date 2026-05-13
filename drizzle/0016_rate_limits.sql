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
