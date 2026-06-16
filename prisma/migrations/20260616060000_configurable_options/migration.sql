-- Convert enum columns to TEXT, preserving existing values (USING ::text).

ALTER TABLE "Client" ALTER COLUMN "source" TYPE TEXT USING "source"::text;
ALTER TABLE "Client" ALTER COLUMN "leadType" TYPE TEXT USING "leadType"::text;

ALTER TABLE "Expense" ALTER COLUMN "category" DROP DEFAULT;
ALTER TABLE "Expense" ALTER COLUMN "category" TYPE TEXT USING "category"::text;
ALTER TABLE "Expense" ALTER COLUMN "category" SET DEFAULT 'OTHER';

ALTER TABLE "FileAsset" ALTER COLUMN "category" DROP DEFAULT;
ALTER TABLE "FileAsset" ALTER COLUMN "category" TYPE TEXT USING "category"::text;
ALTER TABLE "FileAsset" ALTER COLUMN "category" SET DEFAULT 'OTHER';

ALTER TABLE "Payment" ALTER COLUMN "method" DROP DEFAULT;
ALTER TABLE "Payment" ALTER COLUMN "method" TYPE TEXT USING "method"::text;
ALTER TABLE "Payment" ALTER COLUMN "method" SET DEFAULT 'BANK_TRANSFER';

ALTER TABLE "Project" ALTER COLUMN "type" TYPE TEXT USING "type"::text;

-- Drop the now-unused enum types.
DROP TYPE "ClientSource";
DROP TYPE "ExpenseCategory";
DROP TYPE "FileCategory";
DROP TYPE "LeadType";
DROP TYPE "PaymentMethod";
DROP TYPE "ProjectType";

-- User-editable dropdown options.
CREATE TABLE "OptionItem" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "rate" DOUBLE PRECISION,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OptionItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OptionItem_kind_idx" ON "OptionItem"("kind");
CREATE UNIQUE INDEX "OptionItem_kind_value_key" ON "OptionItem"("kind", "value");
