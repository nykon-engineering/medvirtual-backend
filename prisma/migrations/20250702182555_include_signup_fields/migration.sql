/*
  Warnings:

  - Added the required column `companyName` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `jobTitle` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "User_workosId_key";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "companyName" TEXT NOT NULL,
ADD COLUMN     "jobTitle" TEXT NOT NULL;
