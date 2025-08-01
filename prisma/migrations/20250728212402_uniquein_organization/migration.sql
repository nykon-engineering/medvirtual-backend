/*
  Warnings:

  - A unique constraint covering the columns `[email]` on the table `Organization` will be added. If there are existing duplicate values, this will fail.
  - Made the column `email` on table `Organization` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Organization" ALTER COLUMN "email" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Organization_email_key" ON "Organization"("email");
