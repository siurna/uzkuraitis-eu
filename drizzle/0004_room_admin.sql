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
