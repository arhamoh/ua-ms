-- Saved-for-later statement imports (drafts).
CREATE TABLE "PendingImport" (
  "id" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "accountType" TEXT NOT NULL DEFAULT 'BANK',
  "accountLabel" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'CAD',
  "note" TEXT,
  "lines" JSONB NOT NULL,
  "mimeType" TEXT NOT NULL DEFAULT 'application/pdf',
  "data" BYTEA,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdById" TEXT,
  CONSTRAINT "PendingImport_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PendingImport_createdAt_idx" ON "PendingImport"("createdAt");
ALTER TABLE "PendingImport" ADD CONSTRAINT "PendingImport_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
