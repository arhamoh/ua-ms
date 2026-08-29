-- Invoice status: add PARTIAL (partially paid)
ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'PARTIAL' BEFORE 'PAID';

-- Payment: bank reconciliation + optional invoice link
ALTER TABLE "Payment" ADD COLUMN "bankMatchedAt" TIMESTAMP(3);
ALTER TABLE "Payment" ADD COLUMN "invoiceId" TEXT;
CREATE INDEX "Payment_invoiceId_idx" ON "Payment"("invoiceId");
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Expense: GST/QST input tax credits
ALTER TABLE "Expense" ADD COLUMN "gst" DOUBLE PRECISION;
ALTER TABLE "Expense" ADD COLUMN "qst" DOUBLE PRECISION;

-- Non-client income (unmatched bank credits, refunds, interest)
CREATE TABLE "OtherIncome" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'OTHER',
  "amount" DOUBLE PRECISION NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'CAD',
  "amountCad" DOUBLE PRECISION,
  "fxRate" DOUBLE PRECISION,
  "date" TIMESTAMP(3) NOT NULL,
  "note" TEXT,
  "source" TEXT NOT NULL DEFAULT 'MANUAL',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OtherIncome_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OtherIncome_date_idx" ON "OtherIncome"("date");

-- Per-quarter GST/QST remittance state
CREATE TABLE "QuarterlyFiling" (
  "id" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "quarter" INTEGER NOT NULL,
  "incomeOverrideCad" DOUBLE PRECISION,
  "gstReceived" BOOLEAN NOT NULL DEFAULT false,
  "gstReceivedAt" TIMESTAMP(3),
  "qstReceived" BOOLEAN NOT NULL DEFAULT false,
  "qstReceivedAt" TIMESTAMP(3),
  "filedAt" TIMESTAMP(3),
  "filingLink" TEXT,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "QuarterlyFiling_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "QuarterlyFiling_year_quarter_key" ON "QuarterlyFiling"("year", "quarter");
