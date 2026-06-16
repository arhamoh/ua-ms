-- Expense: who fronted the money + reimbursement tracking
ALTER TABLE "Expense" ADD COLUMN "paidById" TEXT;
ALTER TABLE "Expense" ADD COLUMN "reimbursed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Expense" ADD COLUMN "reimbursedAt" TIMESTAMP(3);

CREATE INDEX "Expense_paidById_idx" ON "Expense"("paidById");

ALTER TABLE "Expense"
  ADD CONSTRAINT "Expense_paidById_fkey"
  FOREIGN KEY ("paidById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Loans / money given out that must be recovered
CREATE TABLE "Loan" (
    "id" TEXT NOT NULL,
    "counterparty" TEXT NOT NULL,
    "note" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "amountCad" DOUBLE PRECISION,
    "recoveredAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "givenAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Loan_givenAt_idx" ON "Loan"("givenAt");
