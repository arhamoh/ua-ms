-- Learned categorization rules for recurring statement transactions.
CREATE TABLE "TxnRule" (
  "id" TEXT NOT NULL,
  "matchKey" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'expense',
  "category" TEXT NOT NULL,
  "title" TEXT,
  "hits" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TxnRule_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TxnRule_matchKey_key" ON "TxnRule"("matchKey");
