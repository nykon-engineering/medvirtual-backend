/*
  Warnings:

  - You are about to drop the column `staffing_coordinator` on the `HireRequest` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "HireRequest" DROP COLUMN "staffing_coordinator",
ADD COLUMN     "assign_staffing_coordinator" TEXT;

-- AddForeignKey
ALTER TABLE "HireRequest" ADD CONSTRAINT "HireRequest_assign_staffing_coordinator_fkey" FOREIGN KEY ("assign_staffing_coordinator") REFERENCES "USER"("id") ON DELETE SET NULL ON UPDATE CASCADE;
