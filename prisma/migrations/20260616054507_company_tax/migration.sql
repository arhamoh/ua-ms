-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "taxRegion" TEXT;

-- CreateTable
CREATE TABLE "CompanySetting" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "name" TEXT NOT NULL DEFAULT 'UA Agency',
    "email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "address" TEXT,
    "gstNumber" TEXT,
    "qstNumber" TEXT,
    "neqNumber" TEXT,
    "gstRate" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "qstRate" DOUBLE PRECISION NOT NULL DEFAULT 9.975,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanySetting_pkey" PRIMARY KEY ("id")
);
