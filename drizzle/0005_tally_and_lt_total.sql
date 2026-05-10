-- 0005: tally toggle + lt-total-points bet
ALTER TABLE "rooms"
  ADD COLUMN IF NOT EXISTS "tally_enabled" boolean NOT NULL DEFAULT false;

ALTER TABLE "voters"
  ADD COLUMN IF NOT EXISTS "bet_lt_total_points" integer;
