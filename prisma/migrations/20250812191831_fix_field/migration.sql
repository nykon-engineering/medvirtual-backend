/*
  Warnings:

  - You are about to drop the column `Location` on the `HireRequest` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "HireRequest" DROP COLUMN "Location",
ADD COLUMN     "location" TEXT;
