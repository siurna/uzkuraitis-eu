-- 0006 — now-playing column on rooms.
-- The admin (host) flips this to the country currently performing on
-- stage. Server broadcasts "now-playing:change" to every client in
-- the room; clients render a top strip + spawn a heart-flag swarm.
-- NULL = no country highlighted right now.

ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS now_playing_code text;
