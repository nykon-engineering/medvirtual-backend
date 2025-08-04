/*
  Warnings:

  - You are about to drop the column `duration` on the `CandidateExperience` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "CandidateExperience" DROP COLUMN "duration",
ADD COLUMN     "end_date" TIMESTAMP(3),
ADD COLUMN     "start_date" TIMESTAMP(3);
