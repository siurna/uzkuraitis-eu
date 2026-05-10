-- Side-bet columns for the prediction game's "fun bets" expansion.
-- All nullable, optional inputs alongside the existing top-10 ballot.

ALTER TABLE "voters"
  ADD COLUMN IF NOT EXISTS "bet_wooden_spoon"     text,
  ADD COLUMN IF NOT EXISTS "bet_lt_12_to"          text,
  ADD COLUMN IF NOT EXISTS "bet_highest_big5"      text,
  ADD COLUMN IF NOT EXISTS "bet_jury_winner"       text,
  ADD COLUMN IF NOT EXISTS "bet_televote_winner"   text,
  ADD COLUMN IF NOT EXISTS "bet_nul_televote"      text,
  ADD COLUMN IF NOT EXISTS "bet_same_winners"      boolean,
  ADD COLUMN IF NOT EXISTS "bet_lt_top10"          boolean,
  ADD COLUMN IF NOT EXISTS "bet_lt_top5"           boolean,
  ADD COLUMN IF NOT EXISTS "bet_host_top3"         boolean,
  ADD COLUMN IF NOT EXISTS "bet_winner_solo"       boolean;

-- Generic key-value table for "facts" the admin enters that aren't derivable
-- from official_results placements alone. Keys we use today:
--   jury_winner          (country code)
--   televote_winner      (country code)
--   nul_televote         (country code, or 'NONE')
--   lt_12_to             (country LT gave its 12 to)
--   winner_solo          ('true' or 'false')
-- Easy to extend with more bets without further schema migrations.
CREATE TABLE IF NOT EXISTS "official_facts" (
  "key" text PRIMARY KEY,
  "value" text NOT NULL,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
