-- Accumulated active (non-idle) seconds per check-in session
ALTER TABLE "TimeEntry" ADD COLUMN "activeSeconds" INTEGER NOT NULL DEFAULT 0;
