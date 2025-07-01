/*
  Warnings:

  - A unique constraint covering the columns `[workosId]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `workosId` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "workosId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_workosId_key" ON "User"("workosId");
