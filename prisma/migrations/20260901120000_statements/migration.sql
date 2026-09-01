-- Archived bank / credit-card statement files, stored inline in the DB.
CREATE TABLE "Statement" (
  "id" TEXT NOT NULL,
  "accountType" TEXT NOT NULL DEFAULT 'BANK',
  "accountLabel" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL DEFAULT 'application/pdf',
  "size" INTEGER NOT NULL DEFAULT 0,
  "data" BYTEA NOT NULL,
  "periodLabel" TEXT,
  "note" TEXT,
  "source" TEXT NOT NULL DEFAULT 'UPLOAD',
  "importedExpenses" INTEGER NOT NULL DEFAULT 0,
  "importedIncome" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "uploadedById" TEXT,
  CONSTRAINT "Statement_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Statement_accountType_idx" ON "Statement"("accountType");
CREATE INDEX "Statement_createdAt_idx" ON "Statement"("createdAt");
ALTER TABLE "Statement" ADD CONSTRAINT "Statement_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
