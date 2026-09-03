-- Per-user notification category toggles (which alerts push to their devices).
ALTER TABLE "User" ADD COLUMN "notifyPrefs" JSONB;
