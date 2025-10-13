/*
  Warnings:

  - You are about to drop the column `hubspot_contract_sign_date` on the `Staff` table. All the data in the column will be lost.
  - You are about to drop the column `hubspot_conversion_type` on the `Staff` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Staff" DROP COLUMN "hubspot_contract_sign_date",
DROP COLUMN "hubspot_conversion_type";
