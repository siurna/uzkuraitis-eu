-- 0010 — Coarse show-state on rooms.
-- Admin flips through:
--   not_started → in_progress → break → ended → not_started
-- Voters see different header copy + the tabs hint at "Voting opens"
-- vs "On stage now" vs "Results coming" depending on the value.

ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS show_status text NOT NULL DEFAULT 'not_started';
