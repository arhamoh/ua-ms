-- Uploaded letters/documents with AI analysis + per-letter task boards.
CREATE TABLE "Letter" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "sender" TEXT,
  "reference" TEXT,
  "docDate" TIMESTAMP(3),
  "dueDate" TIMESTAMP(3),
  "language" TEXT NOT NULL DEFAULT 'en',
  "summary" TEXT,
  "translation" TEXT,
  "originalText" TEXT,
  "status" TEXT NOT NULL DEFAULT 'READY',
  "errorNote" TEXT,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL DEFAULT 'application/pdf',
  "size" INTEGER NOT NULL DEFAULT 0,
  "data" BYTEA NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdById" TEXT,
  CONSTRAINT "Letter_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Letter_createdAt_idx" ON "Letter"("createdAt");
ALTER TABLE "Letter" ADD CONSTRAINT "Letter_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "LetterTask" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "detail" TEXT,
  "status" TEXT NOT NULL DEFAULT 'TODO',
  "dueDate" TIMESTAMP(3),
  "order" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "letterId" TEXT NOT NULL,
  CONSTRAINT "LetterTask_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LetterTask_letterId_idx" ON "LetterTask"("letterId");
ALTER TABLE "LetterTask" ADD CONSTRAINT "LetterTask_letterId_fkey"
  FOREIGN KEY ("letterId") REFERENCES "Letter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
