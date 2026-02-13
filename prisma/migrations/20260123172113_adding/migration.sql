/*
  Warnings:

  - A unique constraint covering the columns `[hubspot_contact_id]` on the table `USER` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "USER" ADD COLUMN     "hubspot_contact_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "USER_hubspot_contact_id_key" ON "USER"("hubspot_contact_id");
