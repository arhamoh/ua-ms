-- Tag rows created by a statement import with the resulting Statement id, so an
-- import can be cleared / re-done as a unit.
ALTER TABLE "Expense" ADD COLUMN "statementId" TEXT;
ALTER TABLE "Payment" ADD COLUMN "statementId" TEXT;
ALTER TABLE "OtherIncome" ADD COLUMN "statementId" TEXT;
ALTER TABLE "Transfer" ADD COLUMN "statementId" TEXT;

CREATE INDEX "Expense_statementId_idx" ON "Expense"("statementId");
CREATE INDEX "Payment_statementId_idx" ON "Payment"("statementId");
CREATE INDEX "OtherIncome_statementId_idx" ON "OtherIncome"("statementId");
CREATE INDEX "Transfer_statementId_idx" ON "Transfer"("statementId");
