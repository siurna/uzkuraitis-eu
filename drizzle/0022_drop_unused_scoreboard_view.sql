-- The `scoreboard` view was created in migration 0000 and recreated in
-- 0020. It aggregates per-(room, country) point totals, but nothing in
-- the app reads it — leaderboards are computed in lib/leaderboard.ts
-- against votes + voters directly. Supabase's Security Advisor flags
-- it as a Security Definer view (Postgres views run with the owner's
-- permissions, which bypasses RLS for any caller). Cleanest fix:
-- drop it.

DROP VIEW IF EXISTS "scoreboard";
