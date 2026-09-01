-- Company identifiers shown on the submission cover page.
ALTER TABLE "CompanySetting" ADD COLUMN "corporationNumber" TEXT;
ALTER TABLE "CompanySetting" ADD COLUMN "identificationNumber" TEXT;

-- Letter task answers: written response + French question text.
ALTER TABLE "LetterTask" ADD COLUMN "titleFr" TEXT;
ALTER TABLE "LetterTask" ADD COLUMN "detailFr" TEXT;
ALTER TABLE "LetterTask" ADD COLUMN "response" TEXT;

-- Attachments answering a task: uploaded file bytes, or a reference to a Statement.
CREATE TABLE "TaskAttachment" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'UPLOAD',
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'application/octet-stream',
    "size" INTEGER NOT NULL DEFAULT 0,
    "data" BYTEA,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "taskId" TEXT NOT NULL,
    "statementId" TEXT,
    CONSTRAINT "TaskAttachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TaskAttachment_taskId_idx" ON "TaskAttachment"("taskId");
CREATE INDEX "TaskAttachment_statementId_idx" ON "TaskAttachment"("statementId");

ALTER TABLE "TaskAttachment" ADD CONSTRAINT "TaskAttachment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "LetterTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskAttachment" ADD CONSTRAINT "TaskAttachment_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "Statement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
