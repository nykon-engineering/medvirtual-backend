/*
  Warnings:

  - You are about to drop the column `comfortable_with_basic_tools__google_workspace__zoom__ehr_softw` on the `Candidate` table. All the data in the column will be lost.
  - You are about to drop the column `demonstrates_understanding_of_medical_terminology_and_procedure` on the `Candidate` table. All the data in the column will be lost.
  - You are about to drop the column `familiarity_with_emr_ehr_systems__kareo__athena__eclinicalworks` on the `Candidate` table. All the data in the column will be lost.
  - You are about to drop the column `understands_workflow_in_medical_offices___telehealth_environmen` on the `Candidate` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "AffiliateStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "PayoutMethod" AS ENUM ('ach', 'wire', 'paypal', 'zelle', 'other');

-- CreateEnum
CREATE TYPE "CommissionStatus" AS ENUM ('detected', 'pending_admin_confirmation', 'eligible', 'requested', 'paid', 'void', 'rejected');

-- CreateEnum
CREATE TYPE "PayoutRequestStatus" AS ENUM ('requested', 'approved', 'rejected', 'paid');

-- CreateEnum
CREATE TYPE "MedAllianceAuditSource" AS ENUM ('user', 'sync', 'admin_action');

-- CreateEnum
CREATE TYPE "MedAllianceEntityType" AS ENUM ('referred_company', 'commission', 'payout_request');

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
ALTER TABLE "Organization" ADD COLUMN     "referred_by_affiliate_id" TEXT;

-- CreateTable
CREATE TABLE "AffiliateProfile" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "hubspot_id" TEXT,
    "commission_percent_default" DECIMAL(5,2) NOT NULL,
    "status" "AffiliateStatus" NOT NULL DEFAULT 'active',
    "payout_preference_method" "PayoutMethod",
    "payout_preference_reference" TEXT,
    "payout_preference_notes" TEXT,
    "created_by" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AffiliateProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HubspotInvoiceSnapshot" (
    "id" TEXT NOT NULL,
    "hubspot_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "invoice_status" TEXT NOT NULL,
    "payment_status" TEXT,
    "invoice_amount" DECIMAL(14,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "paid_at" TIMESTAMP(3),
    "sync_hash" TEXT,
    "raw_payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HubspotInvoiceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliateCommission" (
    "id" TEXT NOT NULL,
    "affiliate_id" TEXT NOT NULL,
    "affiliate_profile_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "hubspot_invoice_snapshot_id" TEXT NOT NULL,
    "commission_percent_snapshot" DECIMAL(5,2) NOT NULL,
    "base_amount_snapshot" DECIMAL(14,2) NOT NULL,
    "commission_amount" DECIMAL(14,2) NOT NULL,
    "status" "CommissionStatus" NOT NULL DEFAULT 'detected',
    "idempotency_key" TEXT NOT NULL,
    "admin_decision_by" TEXT,
    "admin_decision_reason" TEXT,
    "admin_decision_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AffiliateCommission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliatePayoutRequest" (
    "id" TEXT NOT NULL,
    "affiliate_id" TEXT NOT NULL,
    "affiliate_profile_id" TEXT NOT NULL,
    "status" "PayoutRequestStatus" NOT NULL DEFAULT 'requested',
    "requested_amount" DECIMAL(14,2) NOT NULL,
    "approved_amount" DECIMAL(14,2),
    "payment_method" "PayoutMethod",
    "payment_reference" TEXT,
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AffiliatePayoutRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliatePayoutRequestCommission" (
    "id" TEXT NOT NULL,
    "payout_request_id" TEXT NOT NULL,
    "commission_id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AffiliatePayoutRequestCommission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedAllianceAuditLog" (
    "id" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "entity_type" "MedAllianceEntityType" NOT NULL,
    "entity_id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "old_status" TEXT,
    "new_status" TEXT,
    "reason" TEXT,
    "source" "MedAllianceAuditSource" NOT NULL DEFAULT 'user',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MedAllianceAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateProfile_user_id_key" ON "AffiliateProfile"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateProfile_hubspot_id_key" ON "AffiliateProfile"("hubspot_id");

-- CreateIndex
CREATE INDEX "idx_affiliate_profiles_status" ON "AffiliateProfile"("status");

-- CreateIndex
CREATE INDEX "idx_affiliate_profiles_user_id" ON "AffiliateProfile"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "HubspotInvoiceSnapshot_hubspot_id_key" ON "HubspotInvoiceSnapshot"("hubspot_id");

-- CreateIndex
CREATE INDEX "idx_hubspot_invoice_snapshots_org_id" ON "HubspotInvoiceSnapshot"("organization_id");

-- CreateIndex
CREATE INDEX "idx_hubspot_invoice_snapshots_invoice_status" ON "HubspotInvoiceSnapshot"("invoice_status");

-- CreateIndex
CREATE INDEX "idx_hubspot_invoice_snapshots_paid_at" ON "HubspotInvoiceSnapshot"("paid_at");

-- CreateIndex
CREATE INDEX "idx_hubspot_invoice_snapshots_sync_hash" ON "HubspotInvoiceSnapshot"("sync_hash");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateCommission_idempotency_key_key" ON "AffiliateCommission"("idempotency_key");

-- CreateIndex
CREATE INDEX "idx_affiliate_commissions_affiliate_status" ON "AffiliateCommission"("affiliate_id", "status");

-- CreateIndex
CREATE INDEX "idx_affiliate_commissions_org_status" ON "AffiliateCommission"("organization_id", "status");

-- CreateIndex
CREATE INDEX "idx_affiliate_commissions_status" ON "AffiliateCommission"("status");

-- CreateIndex
CREATE INDEX "idx_affiliate_commissions_invoice_snapshot" ON "AffiliateCommission"("hubspot_invoice_snapshot_id");

-- CreateIndex
CREATE INDEX "idx_affiliate_payout_requests_affiliate_status" ON "AffiliatePayoutRequest"("affiliate_id", "status");

-- CreateIndex
CREATE INDEX "idx_affiliate_payout_requests_status" ON "AffiliatePayoutRequest"("status");

-- CreateIndex
CREATE INDEX "idx_affiliate_payout_requests_paid_at" ON "AffiliatePayoutRequest"("paid_at");

-- CreateIndex
CREATE INDEX "idx_prc_payout_request_id" ON "AffiliatePayoutRequestCommission"("payout_request_id");

-- CreateIndex
CREATE INDEX "idx_prc_commission_id" ON "AffiliatePayoutRequestCommission"("commission_id");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliatePayoutRequestCommission_payout_request_id_commissi_key" ON "AffiliatePayoutRequestCommission"("payout_request_id", "commission_id");

-- CreateIndex
CREATE INDEX "idx_med_alliance_audit_entity_timeline" ON "MedAllianceAuditLog"("entity_type", "entity_id", "createdAt");

-- CreateIndex
CREATE INDEX "idx_med_alliance_audit_actor" ON "MedAllianceAuditLog"("actor_user_id");

-- CreateIndex
CREATE INDEX "idx_med_alliance_audit_source" ON "MedAllianceAuditLog"("source");

-- CreateIndex
CREATE INDEX "idx_organizations_referred_by" ON "Organization"("referred_by_affiliate_id");

-- CreateIndex
CREATE INDEX "idx_organizations_affiliate_status" ON "Organization"("referred_by_affiliate_id", "status");

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_referred_by_affiliate_id_fkey" FOREIGN KEY ("referred_by_affiliate_id") REFERENCES "USER"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateProfile" ADD CONSTRAINT "AffiliateProfile_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "USER"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HubspotInvoiceSnapshot" ADD CONSTRAINT "HubspotInvoiceSnapshot_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateCommission" ADD CONSTRAINT "AffiliateCommission_affiliate_id_fkey" FOREIGN KEY ("affiliate_id") REFERENCES "USER"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateCommission" ADD CONSTRAINT "AffiliateCommission_affiliate_profile_id_fkey" FOREIGN KEY ("affiliate_profile_id") REFERENCES "AffiliateProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateCommission" ADD CONSTRAINT "AffiliateCommission_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateCommission" ADD CONSTRAINT "AffiliateCommission_hubspot_invoice_snapshot_id_fkey" FOREIGN KEY ("hubspot_invoice_snapshot_id") REFERENCES "HubspotInvoiceSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateCommission" ADD CONSTRAINT "AffiliateCommission_admin_decision_by_fkey" FOREIGN KEY ("admin_decision_by") REFERENCES "USER"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliatePayoutRequest" ADD CONSTRAINT "AffiliatePayoutRequest_affiliate_id_fkey" FOREIGN KEY ("affiliate_id") REFERENCES "USER"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliatePayoutRequest" ADD CONSTRAINT "AffiliatePayoutRequest_affiliate_profile_id_fkey" FOREIGN KEY ("affiliate_profile_id") REFERENCES "AffiliateProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliatePayoutRequest" ADD CONSTRAINT "AffiliatePayoutRequest_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "USER"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliatePayoutRequestCommission" ADD CONSTRAINT "AffiliatePayoutRequestCommission_payout_request_id_fkey" FOREIGN KEY ("payout_request_id") REFERENCES "AffiliatePayoutRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliatePayoutRequestCommission" ADD CONSTRAINT "AffiliatePayoutRequestCommission_commission_id_fkey" FOREIGN KEY ("commission_id") REFERENCES "AffiliateCommission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedAllianceAuditLog" ADD CONSTRAINT "MedAllianceAuditLog_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "USER"("id") ON DELETE SET NULL ON UPDATE CASCADE;
