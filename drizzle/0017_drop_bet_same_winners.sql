-- Drop the dead `bet_same_winners` column. The bet itself was removed
-- from the menu in an earlier pass (it duplicated jury+televote winner
-- picks) and the votes route was writing NULL to satisfy the schema.
-- No code reads it, no code writes it — safe to delete.
ALTER TABLE "voters" DROP COLUMN IF EXISTS "bet_same_winners";
