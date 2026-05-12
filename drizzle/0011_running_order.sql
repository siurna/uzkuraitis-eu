-- 0011 — running-order position on rooms.
-- 1-based index of the act currently on stage (e.g. 12 of 26). The host
-- sets it from the live admin panel alongside now-playing; clients draw a
-- progress bar on the now-playing hero. NULL = unknown / not tracking.

ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS running_order_pos integer;
