/*
  Warnings:

  - You are about to drop the column `comfortable_with_basic_tools__google_workspace__zoom__ehr_softw` on the `Candidate` table. All the data in the column will be lost.
  - You are about to drop the column `demonstrates_understanding_of_medical_terminology_and_procedure` on the `Candidate` table. All the data in the column will be lost.
  - You are about to drop the column `familiarity_with_emr_ehr_systems__kareo__athena__eclinicalworks` on the `Candidate` table. All the data in the column will be lost.
  - You are about to drop the column `understands_workflow_in_medical_offices___telehealth_environmen` on the `Candidate` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "PayoutNoteType" AS ENUM ('internal', 'user');

-- AlterEnum
ALTER TYPE "PayoutRequestStatus" ADD VALUE 'under_review';

-- AlterTable
ALTER TABLE "AffiliatePayoutRequest" ADD COLUMN     "paid_amount" DECIMAL(14,2),
ADD COLUMN     "payment_proof_notes" TEXT,
ADD COLUMN     "reviewed_at" TIMESTAMP(3),
ADD COLUMN     "reviewed_by" TEXT,
ADD COLUMN     "transaction_reference" TEXT;

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
CREATE TABLE "PayoutRequestNote" (
    "id" TEXT NOT NULL,
    "payout_request_id" TEXT NOT NULL,
    "author_user_id" TEXT,
    "type" "PayoutNoteType" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayoutRequestNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_payout_request_notes_request_id" ON "PayoutRequestNote"("payout_request_id");

-- AddForeignKey
ALTER TABLE "AffiliatePayoutRequest" ADD CONSTRAINT "AffiliatePayoutRequest_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "USER"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutRequestNote" ADD CONSTRAINT "PayoutRequestNote_payout_request_id_fkey" FOREIGN KEY ("payout_request_id") REFERENCES "AffiliatePayoutRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutRequestNote" ADD CONSTRAINT "PayoutRequestNote_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "USER"("id") ON DELETE SET NULL ON UPDATE CASCADE;
