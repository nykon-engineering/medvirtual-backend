/*
  Warnings:

  - You are about to drop the column `hubspot_amount` on the `Staff` table. All the data in the column will be lost.
  - You are about to drop the column `hubspot_conversion_date` on the `Staff` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Staff" DROP COLUMN "hubspot_amount",
DROP COLUMN "hubspot_conversion_date";
