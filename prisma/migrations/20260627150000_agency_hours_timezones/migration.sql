-- AlterTable
ALTER TABLE "User" ADD COLUMN     "timezone" TEXT;

-- CreateTable
CREATE TABLE "AgencySchedule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "days" INTEGER[],
    "startMin" INTEGER NOT NULL DEFAULT 540,
    "endMin" INTEGER NOT NULL DEFAULT 1020,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgencySchedule_pkey" PRIMARY KEY ("id")
);

