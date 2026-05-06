/*
  Warnings:

  - You are about to drop the column `comfortable_with_basic_tools__google_workspace__zoom__ehr_softw` on the `Candidate` table. All the data in the column will be lost.
  - You are about to drop the column `demonstrates_understanding_of_medical_terminology_and_procedure` on the `Candidate` table. All the data in the column will be lost.
  - You are about to drop the column `familiarity_with_emr_ehr_systems__kareo__athena__eclinicalworks` on the `Candidate` table. All the data in the column will be lost.
  - You are about to drop the column `understands_workflow_in_medical_offices___telehealth_environmen` on the `Candidate` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "HubspotEntityType" AS ENUM ('candidate', 'hire_request', 'organization', 'contact', 'affiliate', 'deal', 'owner', 'invoice');

-- CreateEnum
CREATE TYPE "HubspotAuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'SYNC', 'BATCH_UPDATE');

-- CreateEnum
CREATE TYPE "HubspotAuditSource" AS ENUM ('user_action', 'cron', 'webhook', 'bulk_sync');

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
CREATE TABLE "HubspotAuditLog" (
    "id" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "actor_label" TEXT,
    "entity_type" "HubspotEntityType" NOT NULL,
    "entity_id" TEXT NOT NULL,
    "hubspot_object_id" TEXT,
    "hubspot_object_type" TEXT NOT NULL,
    "action" "HubspotAuditAction" NOT NULL,
    "source" "HubspotAuditSource" NOT NULL DEFAULT 'user_action',
    "success" BOOLEAN NOT NULL,
    "payload" JSONB,
    "response" JSONB,
    "error_code" TEXT,
    "error_message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HubspotAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_hs_audit_entity_timeline" ON "HubspotAuditLog"("entity_type", "entity_id", "createdAt");

-- CreateIndex
CREATE INDEX "idx_hs_audit_actor" ON "HubspotAuditLog"("actor_user_id");

-- CreateIndex
CREATE INDEX "idx_hs_audit_actor_label" ON "HubspotAuditLog"("actor_label");

-- CreateIndex
CREATE INDEX "idx_hs_audit_source" ON "HubspotAuditLog"("source");

-- CreateIndex
CREATE INDEX "idx_hs_audit_success" ON "HubspotAuditLog"("success");

-- CreateIndex
CREATE INDEX "idx_hs_audit_created_at" ON "HubspotAuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "HubspotAuditLog" ADD CONSTRAINT "HubspotAuditLog_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "USER"("id") ON DELETE SET NULL ON UPDATE CASCADE;
