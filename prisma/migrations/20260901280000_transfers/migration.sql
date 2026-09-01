-- Money movements that are neither income nor expense (e.g. credit-card
-- payments from the bank). Excluded from the P&L and GST so they aren't
-- double-counted against the card's purchases.
CREATE TABLE "Transfer" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'CREDIT_CARD_PAYMENT',
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "amountCad" DOUBLE PRECISION,
    "fxRate" DOUBLE PRECISION,
    "date" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "source" TEXT NOT NULL DEFAULT 'STATEMENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Transfer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Transfer_date_idx" ON "Transfer"("date");
