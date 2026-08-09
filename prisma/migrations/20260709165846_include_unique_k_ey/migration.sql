/*
  Warnings:

  - A unique constraint covering the columns `[hubspot_invoice_snapshot_id]` on the table `AffiliateCommission` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "idx_affiliate_commissions_invoice_snapshot";

-- CreateIndex
CREATE UNIQUE INDEX "uq_affiliate_commissions_invoice_snapshot" ON "AffiliateCommission"("hubspot_invoice_snapshot_id");
