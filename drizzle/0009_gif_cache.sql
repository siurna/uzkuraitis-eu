-- 0009 — GIF search cache (Klipy proxy).
-- Identical search queries hit our DB before hitting Klipy. The API
-- route enforces a 24h TTL on `fetched_at`. PK is the lowercased
-- query so case-sensitive variants share the same cache.

CREATE TABLE IF NOT EXISTS gif_cache (
  q          text PRIMARY KEY,
  results    jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);
