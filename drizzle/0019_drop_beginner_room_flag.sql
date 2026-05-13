-- Undo: rooms.beginner_mode_enabled was added in 0018 on the (wrong)
-- assumption that beginner mode would be a per-room toggle. It's
-- actually per-USER (localStorage, same shape as translate mode). The
-- column has no readers in code and no rows depend on it, so drop it
-- before it accumulates state we'd have to back out later.
--
-- The `chat_helper_cache` table from 0018 stays — it's the shared
-- durable cache for translate + beginner-mode explanations and that
-- design is still correct.
ALTER TABLE "rooms" DROP COLUMN IF EXISTS "beginner_mode_enabled";
