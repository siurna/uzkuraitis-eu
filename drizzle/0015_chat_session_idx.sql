-- Per-session chat lookups: profile drawer, leaderboard's "highlights"
-- aggregation, admin moderation. All filter chat_messages by (room_id,
-- session_id); without this index they fall back to the existing
-- (room_id, created_at) one and scan with a session_id filter.
CREATE INDEX IF NOT EXISTS "chat_room_session_idx"
  ON "chat_messages" ("room_id", "session_id");
