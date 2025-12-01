/*
  Warnings:

  - You are about to drop the column `additional_training_requested` on the `HireRequest` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "HireRequest" DROP COLUMN "additional_training_requested",
ADD COLUMN     "hubspot_additional_training_requested" TEXT;
