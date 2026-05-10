-- 0003: bet refinements
--   * drop redundant LT top10 / top5 (covered by LT placement scoring)
--   * convert nul-televote from a single country pick to a text[] array
--     so voters can hedge with multiple guesses + the "NONE" sentinel.

ALTER TABLE "voters"
  DROP COLUMN IF EXISTS "bet_lt_top10",
  DROP COLUMN IF EXISTS "bet_lt_top5";

-- text  ->  text[].  Wrap any existing single value into a one-element array;
-- nulls stay null. USING handles the cast cleanly.
ALTER TABLE "voters"
  ALTER COLUMN "bet_nul_televote" TYPE text[]
  USING (
    CASE
      WHEN "bet_nul_televote" IS NULL THEN NULL
      ELSE ARRAY["bet_nul_televote"]
    END
  );
