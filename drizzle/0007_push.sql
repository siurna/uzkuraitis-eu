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
