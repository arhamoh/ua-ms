-- Deadline → Google Calendar sync bookkeeping.
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "deadlineEventId" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "deadlineSyncedFor" TIMESTAMP(3);

-- Meeting reminder bookkeeping.
ALTER TABLE "Meeting" ADD COLUMN IF NOT EXISTS "reminderSentAt" TIMESTAMP(3);
