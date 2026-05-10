-- 0008 — Persistent chat. Messages + reactions, scoped per room.
-- Chat is text, GIFs (Klipy), and special "card" kinds (bingo_strike,
-- and any future system message). `meta` jsonb lets us add new kinds
-- without further migrations.

CREATE TABLE IF NOT EXISTS chat_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id    uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  name       text NOT NULL,
  avatar_id  text,
  kind       text NOT NULL DEFAULT 'text',
  body       text,
  gif_url    text,
  reply_to   uuid,
  meta       jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_room_created_idx
  ON chat_messages (room_id, created_at);

CREATE TABLE IF NOT EXISTS chat_reactions (
  message_id uuid NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  name       text NOT NULL,
  emoji      text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, session_id, emoji)
);

CREATE INDEX IF NOT EXISTS chat_react_msg_idx
  ON chat_reactions (message_id);
