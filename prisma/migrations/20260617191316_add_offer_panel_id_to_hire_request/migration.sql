/*
  Warnings:

  - A unique constraint covering the columns `[offer_panel_id]` on the table `HireRequest` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "HireRequest" ADD COLUMN     "offer_panel_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "HireRequest_offer_panel_id_key" ON "HireRequest"("offer_panel_id");

-- AddForeignKey
ALTER TABLE "HireRequest" ADD CONSTRAINT "HireRequest_offer_panel_id_fkey" FOREIGN KEY ("offer_panel_id") REFERENCES "OfferPanel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
