-- CreateEnum
CREATE TYPE "LeadType" AS ENUM ('INVITE', 'GENERATED');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'SALES';

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "leadType" "LeadType",
ADD COLUMN     "salespersonId" TEXT;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "pmCommissionRate" DOUBLE PRECISION NOT NULL DEFAULT 10;

-- CreateTable
CREATE TABLE "CommissionPayout" (
    "id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "method" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "CommissionPayout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommissionPayout_userId_idx" ON "CommissionPayout"("userId");

-- CreateIndex
CREATE INDEX "Client_salespersonId_idx" ON "Client"("salespersonId");

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_salespersonId_fkey" FOREIGN KEY ("salespersonId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionPayout" ADD CONSTRAINT "CommissionPayout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
