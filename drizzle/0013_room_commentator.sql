-- Per-room mute for the live-commentator bot. The commentator is
-- configured globally (one bot, one set of country lines) but a host can
-- silence it for their own room from the magic admin link.
ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "commentator_enabled" boolean NOT NULL DEFAULT true;
