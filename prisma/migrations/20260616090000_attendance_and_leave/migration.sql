-- TimeEntry: support open (not-yet-checked-out) sessions + source
ALTER TABLE "TimeEntry" ALTER COLUMN "checkOutAt" DROP NOT NULL;
ALTER TABLE "TimeEntry" ALTER COLUMN "hours" DROP NOT NULL;
ALTER TABLE "TimeEntry" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'SELF';

-- Leave / vacation / absence requests
CREATE TABLE "LeaveRequest" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'VACATION',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdById" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LeaveRequest_userId_idx" ON "LeaveRequest"("userId");
CREATE INDEX "LeaveRequest_status_idx" ON "LeaveRequest"("status");
ALTER TABLE "LeaveRequest"
  ADD CONSTRAINT "LeaveRequest_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Task activity log (for auto-filling tasks done at checkout)
CREATE TABLE "TaskActivity" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "taskId" TEXT,
    "projectId" TEXT,
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskActivity_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TaskActivity_userId_createdAt_idx" ON "TaskActivity"("userId", "createdAt");
