/*
  Warnings:

  - A unique constraint covering the columns `[hubspot_id]` on the table `Staff` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Staff" ADD COLUMN     "hubspot_amount" DECIMAL(65,30),
ADD COLUMN     "hubspot_client_name" TEXT,
ADD COLUMN     "hubspot_close_date" TIMESTAMP(3),
ADD COLUMN     "hubspot_company_name" TEXT,
ADD COLUMN     "hubspot_contract_sign_date" TIMESTAMP(3),
ADD COLUMN     "hubspot_conversion_date" TIMESTAMP(3),
ADD COLUMN     "hubspot_conversion_type" TEXT,
ADD COLUMN     "hubspot_csm_deal_stage" TEXT,
ADD COLUMN     "hubspot_deal_name" TEXT,
ADD COLUMN     "hubspot_dealstage" TEXT,
ADD COLUMN     "hubspot_dealtype" TEXT,
ADD COLUMN     "hubspot_deployment_type" TEXT,
ADD COLUMN     "hubspot_description" TEXT,
ADD COLUMN     "hubspot_hs_acv" TEXT,
ADD COLUMN     "hubspot_id" TEXT,
ADD COLUMN     "hubspot_pipeline" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Staff_hubspot_id_key" ON "Staff"("hubspot_id");
