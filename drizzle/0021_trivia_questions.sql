-- Editable trivia deck. lib/trivia.ts ships a default deck for fresh
-- installs and for any country the admin hasn't overridden; this table
-- carries the live overrides. The admin UI replaces the whole table
-- wholesale on save, so consumers always read the union (DB row if
-- present, file row otherwise).

CREATE TABLE IF NOT EXISTS "trivia_questions" (
  "country_code"  varchar(2)   PRIMARY KEY,
  "correct_index" integer      NOT NULL CHECK ("correct_index" BETWEEN 0 AND 3),
  "en_question"   text         NOT NULL,
  "en_choices"    text[]       NOT NULL,
  "lt_question"   text         NOT NULL,
  "lt_choices"    text[]       NOT NULL,
  "updated_at"    timestamptz  NOT NULL DEFAULT now()
);
