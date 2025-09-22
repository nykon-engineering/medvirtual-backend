/*
  Warnings:

  - Added the required column `updatedAt` to the `Ticket` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Organization" ALTER COLUMN "admin_id" DROP DEFAULT;

-- AlterTable
-- Add updatedAt column with default value first
ALTER TABLE "Ticket" ADD COLUMN "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

-- Update existing records to set updatedAt to createdAt (since we don't have actual update timestamps)
UPDATE "Ticket" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;

-- Now make the column NOT NULL
ALTER TABLE "Ticket" ALTER COLUMN "updatedAt" SET NOT NULL;

-- CreateIndex
CREATE INDEX "idx_tickets_updatedAt" ON "Ticket"("updatedAt");
