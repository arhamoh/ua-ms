-- Track invoices synced from an external accounting system (e.g. Wave).
ALTER TABLE "Invoice" ADD COLUMN "externalSource" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "externalId" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "externalNumber" TEXT;

-- Dedupe key for re-syncs (Postgres allows multiple NULLs in a unique index).
CREATE UNIQUE INDEX "Invoice_externalId_key" ON "Invoice"("externalId");
