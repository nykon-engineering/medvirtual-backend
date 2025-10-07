/*
  Warnings:

  - You are about to drop the column `hubspot_csm_deal_stage` on the `Staff` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Staff" DROP COLUMN "hubspot_csm_deal_stage";
