/*
  Warnings:

  - You are about to drop the column `comfortable_with_basic_tools__google_workspace__zoom__ehr_softw` on the `Candidate` table. All the data in the column will be lost.
  - You are about to drop the column `demonstrates_understanding_of_medical_terminology_and_procedure` on the `Candidate` table. All the data in the column will be lost.
  - You are about to drop the column `familiarity_with_emr_ehr_systems__kareo__athena__eclinicalworks` on the `Candidate` table. All the data in the column will be lost.
  - You are about to drop the column `understands_workflow_in_medical_offices___telehealth_environmen` on the `Candidate` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "AdminReviewReasonCode" AS ENUM ('multiple_hubspot_matches', 'reconciliation_invoice_changed', 'soft_duplicate_referral');

-- CreateEnum
CREATE TYPE "AdminReviewStatus" AS ENUM ('open', 'resolved');

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
CREATE TABLE "MedAllianceAdminReviewCase" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "reason_code" "AdminReviewReasonCode" NOT NULL,
    "status" "AdminReviewStatus" NOT NULL DEFAULT 'open',
    "metadata" JSONB,
    "resolved_by_id" TEXT,
    "resolved_at" TIMESTAMP(3),
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedAllianceAdminReviewCase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_review_cases_org" ON "MedAllianceAdminReviewCase"("organization_id");

-- CreateIndex
CREATE INDEX "idx_review_cases_status" ON "MedAllianceAdminReviewCase"("status");

-- CreateIndex
CREATE INDEX "idx_review_cases_reason_code" ON "MedAllianceAdminReviewCase"("reason_code");

-- CreateIndex
CREATE UNIQUE INDEX "MedAllianceAdminReviewCase_organization_id_reason_code_stat_key" ON "MedAllianceAdminReviewCase"("organization_id", "reason_code", "status");

-- AddForeignKey
ALTER TABLE "MedAllianceAdminReviewCase" ADD CONSTRAINT "MedAllianceAdminReviewCase_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedAllianceAdminReviewCase" ADD CONSTRAINT "MedAllianceAdminReviewCase_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "USER"("id") ON DELETE SET NULL ON UPDATE CASCADE;
