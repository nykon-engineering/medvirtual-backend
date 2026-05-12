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
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "hubspot_id" TEXT,
    "first_name" TEXT,
    "last_name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "job_title" TEXT,
    "company_name" TEXT,
    "business_unit" TEXT,
    "account_type" TEXT,
    "website_url" TEXT,
    "type" TEXT,
    "referral_source" TEXT,
    "hubspot_owner_id" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Contact_user_id_key" ON "Contact"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_hubspot_id_key" ON "Contact"("hubspot_id");

-- CreateIndex
CREATE INDEX "idx_contacts_user_id" ON "Contact"("user_id");

-- CreateIndex
CREATE INDEX "idx_contacts_hubspot_id" ON "Contact"("hubspot_id");

-- CreateIndex
CREATE INDEX "idx_contacts_email" ON "Contact"("email");

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "USER"("id") ON DELETE CASCADE ON UPDATE CASCADE;
