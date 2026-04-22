/*
  Warnings:

  - You are about to drop the column `comfortable_with_basic_tools__google_workspace__zoom__ehr_softw` on the `Candidate` table. All the data in the column will be lost.
  - You are about to drop the column `demonstrates_understanding_of_medical_terminology_and_procedure` on the `Candidate` table. All the data in the column will be lost.
  - You are about to drop the column `familiarity_with_emr_ehr_systems__kareo__athena__eclinicalworks` on the `Candidate` table. All the data in the column will be lost.
  - You are about to drop the column `understands_workflow_in_medical_offices___telehealth_environmen` on the `Candidate` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Candidate" DROP COLUMN "comfortable_with_basic_tools__google_workspace__zoom__ehr_softw",
DROP COLUMN "demonstrates_understanding_of_medical_terminology_and_procedure",
DROP COLUMN "familiarity_with_emr_ehr_systems__kareo__athena__eclinicalworks",
DROP COLUMN "understands_workflow_in_medical_offices___telehealth_environmen",
ADD COLUMN     "comfortable_with_basic_tools__google_workspace__zoom__ehr_software_" TEXT,
ADD COLUMN     "demonstrates_understanding_of_medical_terminology_and_procedures" TEXT,
ADD COLUMN     "familiarity_with_emr_ehr_systems__kareo__athena__eclinicalworks__etc__" TEXT,
ADD COLUMN     "understands_workflow_in_medical_offices___telehealth_environments" TEXT;

-- CreateTable
CREATE TABLE "HubspotLineItemSnapshot" (
    "id" TEXT NOT NULL,
    "hubspot_id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "quantity" TEXT,
    "amount" DECIMAL(14,2),
    "discount" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HubspotLineItemSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HubspotLineItemSnapshot_hubspot_id_key" ON "HubspotLineItemSnapshot"("hubspot_id");

-- CreateIndex
CREATE INDEX "idx_hubspot_line_item_snapshots_invoice_id" ON "HubspotLineItemSnapshot"("invoice_id");

-- AddForeignKey
ALTER TABLE "HubspotLineItemSnapshot" ADD CONSTRAINT "HubspotLineItemSnapshot_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "HubspotInvoiceSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
