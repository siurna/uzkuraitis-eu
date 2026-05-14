-- Tiny global key/value store for editable site content (welcome /
-- housekeeping notes shown on the home screen, in either language).
-- One row per (key, lang) — keys today are 'welcome_md_en' /
-- 'welcome_md_lt' but the table is generic so future surfaces can drop
-- in without a migration. Keeping it separate from official_facts so
-- "any facts row exists" doesn't accidentally flip the leaderboard's
-- hasResults flag.

CREATE TABLE IF NOT EXISTS "site_content" (
  "key"        text         PRIMARY KEY,
  "value"      text         NOT NULL,
  "updated_at" timestamptz  NOT NULL DEFAULT now()
);
