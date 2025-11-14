/*
  Warnings:

  - A unique constraint covering the columns `[hubspot_ticket_id]` on the table `HireRequest` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "HireRequest" ADD COLUMN     "hubspot_ticket_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "HireRequest_hubspot_ticket_id_key" ON "HireRequest"("hubspot_ticket_id");
