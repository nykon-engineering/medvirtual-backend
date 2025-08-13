/*
  Warnings:

  - You are about to drop the column `responsibilities` on the `CandidateExperience` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "CandidateExperience" DROP COLUMN "responsibilities",
ADD COLUMN     "responsabilities" TEXT;
