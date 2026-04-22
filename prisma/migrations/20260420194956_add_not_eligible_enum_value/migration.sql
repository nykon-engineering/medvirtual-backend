/*
  Warnings:

  - The values [not_eligible_active_client,needs_admin_review] on the enum `MedAllianceReferralStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `comfortable_with_basic_tools__google_workspace__zoom__ehr_softw` on the `Candidate` table. All the data in the column will be lost.
  - You are about to drop the column `demonstrates_understanding_of_medical_terminology_and_procedure` on the `Candidate` table. All the data in the column will be lost.
  - You are about to drop the column `familiarity_with_emr_ehr_systems__kareo__athena__eclinicalworks` on the `Candidate` table. All the data in the column will be lost.
  - You are about to drop the column `understands_workflow_in_medical_offices___telehealth_environmen` on the `Candidate` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "MedAllianceReferralStatus_new" AS ENUM ('eligible', 'not_eligible');
ALTER TABLE "Organization" ALTER COLUMN "med_alliance_referral_status" TYPE "MedAllianceReferralStatus_new" USING ("med_alliance_referral_status"::text::"MedAllianceReferralStatus_new");
ALTER TYPE "MedAllianceReferralStatus" RENAME TO "MedAllianceReferralStatus_old";
ALTER TYPE "MedAllianceReferralStatus_new" RENAME TO "MedAllianceReferralStatus";
DROP TYPE "public"."MedAllianceReferralStatus_old";
COMMIT;

-- AlterTable
ALTER TABLE "Candidate" DROP COLUMN "comfortable_with_basic_tools__google_workspace__zoom__ehr_softw",
DROP COLUMN "demonstrates_understanding_of_medical_terminology_and_procedure",
DROP COLUMN "familiarity_with_emr_ehr_systems__kareo__athena__eclinicalworks",
DROP COLUMN "understands_workflow_in_medical_offices___telehealth_environmen",
ADD COLUMN     "comfortable_with_basic_tools__google_workspace__zoom__ehr_software_" TEXT,
ADD COLUMN     "demonstrates_understanding_of_medical_terminology_and_procedures" TEXT,
ADD COLUMN     "familiarity_with_emr_ehr_systems__kareo__athena__eclinicalworks__etc__" TEXT,
ADD COLUMN     "understands_workflow_in_medical_offices___telehealth_environments" TEXT;

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "eligibility_start_at" TIMESTAMP(3),
ADD COLUMN     "first_paid_invoice_at" TIMESTAMP(3);
